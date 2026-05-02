import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { prisma } from "../../../../../lib/prisma";
import { GoogleCalendarService } from "../../../../../lib/services/GoogleCalendarService";

async function resolveUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return prisma.user.upsert({
    where: { email: user.email! },
    create: { id: user.id, email: user.email!, name: user.user_metadata?.full_name ?? user.email!.split("@")[0] },
    update: {},
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // familyId
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/configuracoes?error=google_denied", appUrl));
  }

  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  const family = await prisma.family.findFirst({
    where: { id: state, owner_id: prismaUser.id },
  });
  if (!family) {
    return NextResponse.redirect(new URL("/configuracoes?error=google_invalid_state", appUrl));
  }

  let refreshToken: string;
  try {
    const service = new GoogleCalendarService();
    const tokens = await service.exchangeCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/configuracoes?error=google_no_refresh_token", appUrl));
    }
    refreshToken = tokens.refresh_token;
  } catch (err) {
    console.error("[Calendar] Token exchange failed:", err);
    return NextResponse.redirect(new URL("/configuracoes?error=google_token_failed", appUrl));
  }

  const settings = (family.settings as Record<string, unknown>) ?? {};
  await prisma.family.update({
    where: { id: family.id },
    data: { settings: { ...settings, google_refresh_token: refreshToken } as any },
  });

  // Sync bidirecional inicial (fire and forget)
  runInitialSync(family.id, prismaUser.id, refreshToken, settings).catch((err) =>
    console.error("[Calendar] Initial sync failed:", err)
  );

  return NextResponse.redirect(new URL("/configuracoes?calendar=connected", appUrl));
}

async function runInitialSync(
  familyId: string,
  ownerId: string,
  refreshToken: string,
  prevSettings: Record<string, unknown>
) {
  const { GoogleCalendarService } = await import("../../../../../lib/services/GoogleCalendarService");
  const service = new GoogleCalendarService();

  // Fase 1: Google → App (importar eventos externos)
  const externalEvents = await service.listExternalEvents(refreshToken);
  const importMap = (prevSettings.google_import_map as Record<string, string>) ?? {};
  const newImportMap = { ...importMap };
  const seenIds = new Set(externalEvents.map((e) => e.id));
  let imported = 0;

  for (const event of externalEvents) {
    const start = new Date(event.start?.dateTime ?? event.start?.date ?? Date.now());
    const end = event.end ? new Date(event.end.dateTime ?? event.end.date ?? start) : null;
    const title = event.summary?.trim() || "Sem título";
    if (!importMap[event.id]) {
      const created = await prisma.activity.create({
        data: {
          family_id: familyId,
          created_by: ownerId,
          title,
          description: event.description ?? null,
          location: event.location ?? null,
          category: "OTHER",
          start_at: start,
          end_at: end,
          source: "WEB",
          status: "ACTIVE",
        },
      });
      newImportMap[event.id] = created.id;
      imported++;
    }
  }

  for (const [googleId, activityId] of Object.entries(importMap)) {
    if (!seenIds.has(googleId)) {
      await prisma.activity.updateMany({ where: { id: activityId, family_id: familyId }, data: { status: "CANCELLED" } });
      delete newImportMap[googleId];
    }
  }

  const freshFamily = await prisma.family.findUnique({ where: { id: familyId }, select: { settings: true } });
  const updatedSettings = { ...(freshFamily?.settings as Record<string, unknown> ?? {}), google_import_map: newImportMap };
  await prisma.family.update({ where: { id: familyId }, data: { settings: updatedSettings as any } });

  // Fase 2: App → Google (exportar atividades nativas)
  const importedIds = new Set(Object.values(newImportMap));
  const all = await prisma.activity.findMany({ where: { family_id: familyId } });
  const toExport = all.filter((a) => !importedIds.has(a.id));
  const exportResult = await service.syncActivities(refreshToken, toExport as any);

  console.log(`[Calendar] Initial sync done: imported=${imported} | exported created=${exportResult.created} updated=${exportResult.updated}`);
}

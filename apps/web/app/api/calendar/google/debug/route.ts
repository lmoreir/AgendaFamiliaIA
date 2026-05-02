import { NextResponse } from "next/server";
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

export async function GET() {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const family = await prisma.family.findFirst({ where: { owner_id: prismaUser.id } });
  if (!family) return NextResponse.json({ error: "Família não encontrada" }, { status: 404 });

  const settings = (family.settings as Record<string, unknown>) ?? {};
  const refreshToken = settings.google_refresh_token as string | undefined;
  const importMap = (settings.google_import_map as Record<string, string>) ?? {};
  const service = new GoogleCalendarService();

  const result: Record<string, unknown> = {
    configured: service.isConfigured(),
    connected: !!refreshToken,
    importMapSize: Object.keys(importMap).length,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "(não definida)",
  };

  if (!refreshToken) {
    return NextResponse.json({ ...result, step: "NO_REFRESH_TOKEN" });
  }

  // Testa obtenção de access token
  let accessToken: string;
  try {
    accessToken = await service.getAccessToken(refreshToken);
    result.tokenOk = true;
  } catch (err: any) {
    return NextResponse.json({ ...result, step: "TOKEN_REFRESH_FAILED", error: err?.message });
  }

  // Testa listagem de eventos
  try {
    const events = await service.listExternalEvents(refreshToken);
    result.step = "OK";
    result.externalEventsCount = events.length;
    result.sampleTitles = events.slice(0, 5).map((e) => e.summary ?? "(sem título)");
  } catch (err: any) {
    return NextResponse.json({ ...result, step: "LIST_EVENTS_FAILED", error: err?.message });
  }

  return NextResponse.json(result);
}

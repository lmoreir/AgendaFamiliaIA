import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { prisma } from "../../../../../lib/prisma";
import { fetchAndParseICal } from "../../../../../lib/services/ICalImportService";

async function resolveUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return prisma.user.upsert({
    where: { email: user.email! },
    create: { id: user.id, email: user.email!, name: user.user_metadata?.full_name ?? user.email!.split("@")[0] },
    update: {},
  });
}

/** POST — salva URL e dispara importação inicial */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const family = await prisma.family.findFirst({ where: { owner_id: prismaUser.id } });
  if (!family) return NextResponse.json({ error: "Família não encontrada" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const importUrl = (body.url as string | undefined)?.trim();

  const settings = (family.settings as Record<string, unknown>) ?? {};

  if (!importUrl) {
    // Remover integração iCal import
    const { ical_import_url: _u, ical_import_map: _m, ...rest } = settings;
    await prisma.family.update({ where: { id: family.id }, data: { settings: rest as any } });
    return NextResponse.json({ success: true, removed: true });
  }

  try { new URL(importUrl); } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const existingMap = (settings.ical_import_map as Record<string, string>) ?? {};
  const result = await runICalImport(family.id, prismaUser.id, importUrl, existingMap);

  await prisma.family.update({
    where: { id: family.id },
    data: {
      settings: {
        ...settings,
        ical_import_url: importUrl,
        ical_import_map: result.newMap,
      } as any,
    },
  });

  return NextResponse.json({ success: true, imported: result.imported, updated: result.updated, removed: result.removed });
}

/** DELETE — remove a integração */
export async function DELETE() {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const family = await prisma.family.findFirst({ where: { owner_id: prismaUser.id } });
  if (!family) return NextResponse.json({ error: "Família não encontrada" }, { status: 404 });

  const { ical_import_url: _u, ical_import_map: _m, ...rest } = (family.settings as Record<string, unknown>) ?? {};
  await prisma.family.update({ where: { id: family.id }, data: { settings: rest as any } });
  return NextResponse.json({ success: true });
}

export async function runICalImport(
  familyId: string,
  userId: string,
  url: string,
  existingMap: Record<string, string>
): Promise<{ imported: number; updated: number; removed: number; newMap: Record<string, string> }> {
  const events = await fetchAndParseICal(url);
  const newMap = { ...existingMap };
  let imported = 0, updated = 0, removed = 0;

  const seenUids = new Set(events.map((e) => e.uid));

  for (const event of events) {
    const existingId = existingMap[event.uid];
    if (existingId) {
      await prisma.activity.updateMany({
        where: { id: existingId, family_id: familyId },
        data: {
          title: event.summary,
          description: event.description ?? null,
          location: event.location ?? null,
          start_at: event.start,
          end_at: event.end ?? null,
        },
      });
      updated++;
    } else {
      const created = await prisma.activity.create({
        data: {
          family_id: familyId,
          created_by: userId,
          title: event.summary,
          description: event.description ?? null,
          location: event.location ?? null,
          category: "OTHER",
          start_at: event.start,
          end_at: event.end ?? null,
          source: "WEB",
          status: "ACTIVE",
        },
      });
      newMap[event.uid] = created.id;
      imported++;
    }
  }

  for (const [uid, activityId] of Object.entries(existingMap)) {
    if (!seenUids.has(uid)) {
      await prisma.activity.updateMany({
        where: { id: activityId, family_id: familyId },
        data: { status: "CANCELLED" },
      });
      delete newMap[uid];
      removed++;
    }
  }

  return { imported, updated, removed, newMap };
}

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

export async function POST() {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const family = await prisma.family.findFirst({ where: { owner_id: prismaUser.id } });
  if (!family) return NextResponse.json({ error: "Família não encontrada" }, { status: 404 });

  const settings = (family.settings as Record<string, unknown>) ?? {};
  const refreshToken = settings.google_refresh_token as string | undefined;
  if (!refreshToken) return NextResponse.json({ error: "Google Calendar não conectado" }, { status: 400 });

  const service = new GoogleCalendarService();

  try {
    // ── FASE 1: Google → App (importar eventos externos) ──────────────────
    const externalEvents = await service.listExternalEvents(refreshToken);
    const importMap = (settings.google_import_map as Record<string, string>) ?? {};
    const newImportMap = { ...importMap };

    const seenGoogleIds = new Set(externalEvents.map((e) => e.id));
    let imported = 0, importUpdated = 0, importRemoved = 0;

    for (const event of externalEvents) {
      const start = new Date(event.start?.dateTime ?? event.start?.date ?? Date.now());
      const end = event.end ? new Date(event.end.dateTime ?? event.end.date ?? start) : null;
      const title = event.summary?.trim() || "Sem título";

      const existingId = importMap[event.id];
      if (existingId) {
        await prisma.activity.updateMany({
          where: { id: existingId, family_id: family.id },
          data: { title, description: event.description ?? null, location: event.location ?? null, start_at: start, end_at: end },
        });
        importUpdated++;
      } else {
        const created = await prisma.activity.create({
          data: {
            family_id: family.id,
            created_by: prismaUser.id,
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

    // Cancelar atividades cujo evento do Google foi removido
    for (const [googleId, activityId] of Object.entries(importMap)) {
      if (!seenGoogleIds.has(googleId)) {
        await prisma.activity.updateMany({
          where: { id: activityId, family_id: family.id },
          data: { status: "CANCELLED" },
        });
        delete newImportMap[googleId];
        importRemoved++;
      }
    }

    // Salvar mapa atualizado
    const updatedSettings = { ...settings, google_import_map: newImportMap };
    await prisma.family.update({
      where: { id: family.id },
      data: { settings: updatedSettings as any },
    });

    // ── FASE 2: App → Google (exportar atividades nativas) ────────────────
    const importedActivityIds = new Set(Object.values(newImportMap));
    const allActivities = await prisma.activity.findMany({ where: { family_id: family.id } });

    // Só exporta atividades que NÃO foram importadas do Google (evita duplicatas)
    const activitiesToExport = allActivities.filter((a) => !importedActivityIds.has(a.id));
    const exportResult = await service.syncActivities(refreshToken, activitiesToExport as any);

    console.log(`[Calendar] Sync família ${family.id}: importados=${imported} atualizados=${importUpdated} removidos=${importRemoved} | exportados criados=${exportResult.created} atualizados=${exportResult.updated} removidos=${exportResult.deleted}`);

    return NextResponse.json({
      success: true,
      import: { imported, updated: importUpdated, removed: importRemoved },
      export: exportResult,
    });
  } catch (err: any) {
    console.error("[Calendar] Sync falhou:", err?.message);
    return NextResponse.json({ error: "Falha ao sincronizar com Google Calendar" }, { status: 500 });
  }
}

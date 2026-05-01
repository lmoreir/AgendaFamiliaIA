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
  if (!refreshToken) {
    return NextResponse.json({ error: "Google Calendar não conectado" }, { status: 400 });
  }

  const activities = await prisma.activity.findMany({
    where: { family_id: family.id },
    orderBy: { start_at: "asc" },
  });

  const service = new GoogleCalendarService();
  try {
    const result = await service.syncActivities(refreshToken, activities as any);
    console.log(`[Calendar] Sync result for family ${family.id}:`, result);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[Calendar] Sync failed:", err?.message);
    return NextResponse.json({ error: "Falha ao sincronizar com Google Calendar" }, { status: 500 });
  }
}

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

  if (refreshToken) {
    try {
      const service = new GoogleCalendarService();
      await service.revokeToken(refreshToken);
    } catch {
      // Revocation is best-effort
    }
  }

  const { google_refresh_token: _removed, ...rest } = settings;
  await prisma.family.update({
    where: { id: family.id },
    data: { settings: rest as any },
  });

  return NextResponse.json({ success: true });
}

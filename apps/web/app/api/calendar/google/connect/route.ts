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
  if (!prismaUser) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL!));
  }

  const family = await prisma.family.findFirst({ where: { owner_id: prismaUser.id } });
  if (!family) {
    return NextResponse.redirect(new URL("/configuracoes", process.env.NEXT_PUBLIC_APP_URL!));
  }

  const service = new GoogleCalendarService();
  if (!service.isConfigured()) {
    return NextResponse.redirect(
      new URL("/configuracoes?error=google_not_configured", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const authUrl = service.getAuthUrl(family.id);
  return NextResponse.redirect(authUrl);
}

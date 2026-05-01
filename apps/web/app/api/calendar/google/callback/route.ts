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
    data: {
      settings: {
        ...settings,
        google_refresh_token: refreshToken,
      } as any,
    },
  });

  // Run initial sync in the background (fire and forget)
  runInitialSync(family.id, refreshToken).catch((err) =>
    console.error("[Calendar] Initial sync failed:", err)
  );

  return NextResponse.redirect(new URL("/configuracoes?calendar=connected", appUrl));
}

async function runInitialSync(familyId: string, refreshToken: string) {
  const { GoogleCalendarService } = await import("../../../../../lib/services/GoogleCalendarService");
  const service = new GoogleCalendarService();
  const activities = await prisma.activity.findMany({
    where: { family_id: familyId },
    orderBy: { start_at: "asc" },
  });
  const result = await service.syncActivities(refreshToken, activities as any);
  console.log(`[Calendar] Initial sync done: created=${result.created} updated=${result.updated} deleted=${result.deleted}`);
}

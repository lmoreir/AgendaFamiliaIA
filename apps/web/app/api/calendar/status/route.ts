import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { prisma } from "../../../../lib/prisma";
import { GoogleCalendarService } from "../../../../lib/services/GoogleCalendarService";

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
  if (!family) return NextResponse.json({ ical: null, icalImport: null, google: { connected: false, configured: false } });

  const settings = (family.settings as Record<string, unknown>) ?? {};
  const icalToken = settings.ical_token as string | undefined;
  const icalImportUrl = settings.ical_import_url as string | undefined;
  const googleConnected = !!(settings.google_refresh_token as string | undefined);
  const googleConfigured = new GoogleCalendarService().isConfigured();
  const syncInterval = (settings.calendar_sync_interval as string | undefined) ?? "hourly";
  const lastSyncedAt = (settings.calendar_last_synced_at as string | undefined) ?? null;

  return NextResponse.json({
    ical: icalToken ? { token: icalToken } : null,
    icalImport: icalImportUrl ? { url: icalImportUrl } : null,
    google: { connected: googleConnected, configured: googleConfigured },
    syncInterval,
    lastSyncedAt,
  });
}

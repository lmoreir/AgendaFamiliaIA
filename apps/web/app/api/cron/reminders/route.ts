import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { WhatsAppService } from "../../../../lib/services";
import { GoogleCalendarService } from "../../../../lib/services/GoogleCalendarService";
import { runICalImport } from "../../../../lib/services/ICalImportService";

const WINDOW_MS = 65 * 60 * 1000; // 65 min — cobre a janela entre execuções horárias
const whatsapp = new WhatsAppService();

function formatDate(date: Date): string {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildEmailHtml(opts: {
  activityTitle: string;
  childName: string | null;
  startAt: Date;
  location: string | null;
  minutesBefore: number;
}): string {
  const when = formatDate(opts.startAt);
  const who = opts.childName ? ` de ${opts.childName}` : "";
  const timeLabel =
    opts.minutesBefore <= 60
      ? `em ${opts.minutesBefore} minutos`
      : opts.minutesBefore <= 1440
      ? "amanhã"
      : `em ${Math.round(opts.minutesBefore / 60 / 24)} dias`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Lembrete de Atividade</p>
    <h1 style="margin:0 0 4px;font-size:22px;color:#111827">${opts.activityTitle}${who}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151">Começa <strong>${timeLabel}</strong></p>
    <div style="background:#f3f4f6;border-radius:8px;padding:16px;font-size:14px;color:#374151">
      <p style="margin:0 0 6px"><strong>Quando:</strong> ${when}</p>
      ${opts.location ? `<p style="margin:0"><strong>Onde:</strong> ${opts.location}</p>` : ""}
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center">Agenda Família IA</p>
  </div>
</body>
</html>`;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL ?? "onboarding@resend.dev";
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY nao configurada" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[cron/reminders] Resend error:", err);
    return { ok: false, error: err };
  }
  return { ok: true };
}

async function handleReminders(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + WINDOW_MS);

  const pending = await prisma.reminder.findMany({
    where: { status: "PENDING", trigger_at: { lte: horizon } },
    include: {
      activity: { include: { child: true } },
      family: { include: { owner: true } },
    },
  });

  console.log(`[cron/reminders] ${pending.length} lembrete(s) pendente(s)`);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const reminder of pending) {
    const owner = (reminder.family as any).owner;
    const diffMs = reminder.activity.start_at.getTime() - now.getTime();
    const minutesBefore = Math.max(Math.round(diffMs / 60000), 0);
    const childName = reminder.activity.child?.name ?? null;
    const channels: string[] = (reminder.channels as string[]) ?? [];

    console.log(`[cron/reminders] Lembrete ${reminder.id} | canais: ${channels.join(",")} | ${minutesBefore}min antes`);

    let anyOk = false;
    let lastError: string | undefined;

    const familySettings = ((reminder.family as any).settings ?? {}) as {
      secondary_whatsapp?: string | null;
      notify_email?: boolean;
    };

    // --- Canal WHATSAPP ---
    if (channels.includes("WHATSAPP")) {
      const phone = owner?.phone_whatsapp as string | null;
      if (!phone) {
        const msg = `reminder ${reminder.id}: owner sem phone_whatsapp`;
        console.warn(`[cron/reminders] ${msg}`);
        errors.push(msg);
      } else {
        try {
          await whatsapp.sendActivityReminder({
            to: phone,
            activityTitle: reminder.activity.title,
            childName,
            startAt: reminder.activity.start_at,
            location: reminder.activity.location ?? undefined,
            minutesBefore,
          });
          console.log(`[cron/reminders] WhatsApp enviado para ${phone}`);
          anyOk = true;
        } catch (err: any) {
          lastError = `WhatsApp error: ${err?.message}`;
          console.error(`[cron/reminders] Erro WhatsApp:`, err?.message);
          errors.push(lastError);
        }
      }

      // Segundo número WhatsApp (configuração da família)
      const secondaryPhone = familySettings.secondary_whatsapp;
      if (secondaryPhone) {
        try {
          await whatsapp.sendActivityReminder({
            to: secondaryPhone,
            activityTitle: reminder.activity.title,
            childName,
            startAt: reminder.activity.start_at,
            location: reminder.activity.location ?? undefined,
            minutesBefore,
          });
          console.log(`[cron/reminders] WhatsApp secundário enviado para ${secondaryPhone}`);
          anyOk = true;
        } catch (err: any) {
          console.error(`[cron/reminders] Erro WhatsApp secundário:`, err?.message);
          errors.push(`WhatsApp secundário error: ${err?.message}`);
        }
      }
    }

    // --- Canal EMAIL ---
    if (channels.includes("EMAIL")) {
      const email = owner?.email as string | null;
      if (!email) {
        const msg = `reminder ${reminder.id}: owner sem email`;
        console.warn(`[cron/reminders] ${msg}`);
        errors.push(msg);
      } else {
        const who = childName ? ` de ${childName}` : "";
        const subject = `Lembrete: ${reminder.activity.title}${who}`;
        const html = buildEmailHtml({
          activityTitle: reminder.activity.title,
          childName,
          startAt: reminder.activity.start_at,
          location: reminder.activity.location ?? null,
          minutesBefore,
        });
        const result = await sendEmail({ to: email, subject, html });
        if (result.ok) {
          console.log(`[cron/reminders] Email enviado para ${email}`);
          anyOk = true;
        } else {
          lastError = result.error;
          errors.push(result.error ?? "email error");
        }
      }
    }

    // --- Email por preferência da família (notify_email) ---
    if (familySettings.notify_email && !channels.includes("EMAIL")) {
      const email = owner?.email as string | null;
      if (email) {
        const who = childName ? ` de ${childName}` : "";
        const subject = `Lembrete: ${reminder.activity.title}${who}`;
        const html = buildEmailHtml({
          activityTitle: reminder.activity.title,
          childName,
          startAt: reminder.activity.start_at,
          location: reminder.activity.location ?? null,
          minutesBefore,
        });
        const result = await sendEmail({ to: email, subject, html });
        if (result.ok) {
          console.log(`[cron/reminders] Email (preferência família) enviado para ${email}`);
          anyOk = true;
        } else {
          console.error(`[cron/reminders] Erro email preferência família:`, result.error);
          errors.push(result.error ?? "email error");
        }
      }
    }

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: anyOk ? "SENT" : "FAILED",
        sent_at: anyOk ? now : undefined,
        error_msg: anyOk ? undefined : lastError,
      },
    });

    anyOk ? sent++ : failed++;
  }

  console.log(`[cron/reminders] processed=${pending.length} sent=${sent} failed=${failed}`);

  // ── Sincronização de calendários externos ──────────────────────────────
  await syncAllCalendars();

  return NextResponse.json({ processed: pending.length, sent, failed, errors });
}

async function syncAllCalendars(): Promise<void> {
  try {
    const families = await prisma.family.findMany({ select: { id: true, owner_id: true, settings: true } });
    const googleService = new GoogleCalendarService();

    for (const family of families) {
      const settings = (family.settings as Record<string, unknown>) ?? {};

      // Google Calendar bidirecional
      const refreshToken = settings.google_refresh_token as string | undefined;
      if (refreshToken && googleService.isConfigured()) {
        try {
          await syncGoogleForFamily(family.id, family.owner_id, refreshToken, settings, googleService);
          console.log(`[cron/calendar] Google sync ok para família ${family.id}`);
        } catch (err: any) {
          console.error(`[cron/calendar] Google sync falhou família ${family.id}:`, err?.message);
        }
      }

      // iCal import
      const icalImportUrl = settings.ical_import_url as string | undefined;
      if (icalImportUrl) {
        try {
          await syncICalForFamily(family.id, family.owner_id, icalImportUrl, settings);
          console.log(`[cron/calendar] iCal sync ok para família ${family.id}`);
        } catch (err: any) {
          console.error(`[cron/calendar] iCal sync falhou família ${family.id}:`, err?.message);
        }
      }
    }
  } catch (err: any) {
    console.error("[cron/calendar] Erro geral na sincronização:", err?.message);
  }
}

async function syncGoogleForFamily(
  familyId: string,
  ownerId: string,
  refreshToken: string,
  settings: Record<string, unknown>,
  service: GoogleCalendarService
): Promise<void> {
  const externalEvents = await service.listExternalEvents(refreshToken);
  const importMap = (settings.google_import_map as Record<string, string>) ?? {};
  const newImportMap = { ...importMap };
  const seenGoogleIds = new Set(externalEvents.map((e) => e.id));

  for (const event of externalEvents) {
    const start = new Date(event.start?.dateTime ?? event.start?.date ?? Date.now());
    const end = event.end ? new Date(event.end.dateTime ?? event.end.date ?? start) : null;
    const title = event.summary?.trim() || "Sem título";
    const existingId = importMap[event.id];

    if (existingId) {
      await prisma.activity.updateMany({
        where: { id: existingId, family_id: familyId },
        data: { title, description: event.description ?? null, location: event.location ?? null, start_at: start, end_at: end },
      });
    } else {
      const created = await prisma.activity.create({
        data: { family_id: familyId, created_by: ownerId, title, description: event.description ?? null, location: event.location ?? null, category: "OTHER", start_at: start, end_at: end, source: "WEB", status: "ACTIVE" },
      });
      newImportMap[event.id] = created.id;
    }
  }

  for (const [googleId, activityId] of Object.entries(importMap)) {
    if (!seenGoogleIds.has(googleId)) {
      await prisma.activity.updateMany({ where: { id: activityId, family_id: familyId }, data: { status: "CANCELLED" } });
      delete newImportMap[googleId];
    }
  }

  const updatedSettings = { ...settings, google_import_map: newImportMap };
  await prisma.family.update({ where: { id: familyId }, data: { settings: updatedSettings as any } });

  const importedIds = new Set(Object.values(newImportMap));
  const allActivities = await prisma.activity.findMany({ where: { family_id: familyId } });
  const toExport = allActivities.filter((a) => !importedIds.has(a.id));
  await service.syncActivities(refreshToken, toExport as any);
}

async function syncICalForFamily(
  familyId: string,
  ownerId: string,
  url: string,
  settings: Record<string, unknown>
): Promise<void> {
  const importMap = (settings.ical_import_map as Record<string, string>) ?? {};
  const result = await runICalImport(familyId, ownerId, url, importMap);
  await prisma.family.update({
    where: { id: familyId },
    data: { settings: { ...settings, ical_import_map: result.newMap } as any },
  });
}

export async function POST(request: NextRequest) {
  return handleReminders(request);
}

export async function GET(request: NextRequest) {
  return handleReminders(request);
}

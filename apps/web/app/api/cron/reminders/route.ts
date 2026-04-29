import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { WhatsAppService } from "../../../../lib/services";

const WINDOW_MS = 10 * 60 * 1000;
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
  return NextResponse.json({ processed: pending.length, sent, failed, errors });
}

export async function POST(request: NextRequest) {
  return handleReminders(request);
}

export async function GET(request: NextRequest) {
  return handleReminders(request);
}

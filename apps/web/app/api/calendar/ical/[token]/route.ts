import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

function toICalDate(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
}

function escapeText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) {
    parts.push(" " + line.slice(i, i + 74));
  }
  return parts.join("\r\n");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  if (!token || token.length < 8) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Find family by ical_token stored in settings JSON
  const families = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM families WHERE settings->>'ical_token' = ${token} LIMIT 1
  `;

  if (!families.length) {
    return new NextResponse("Not found", { status: 404 });
  }

  const family = families[0];

  const activities = await prisma.activity.findMany({
    where: { family_id: family.id, status: "ACTIVE" },
    include: { child: { select: { name: true } } },
    orderBy: { start_at: "asc" },
  });

  const now = toICalDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agenda Familia IA//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeText(family.name)} - Agenda`),
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const activity of activities) {
    const end = activity.end_at ?? new Date(activity.start_at.getTime() + 60 * 60 * 1000);
    const summary = activity.child
      ? `${activity.title} (${activity.child.name})`
      : activity.title;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${activity.id}@agendafamilia.app`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${toICalDate(activity.start_at)}`);
    lines.push(`DTEND:${toICalDate(end)}`);
    lines.push(foldLine(`SUMMARY:${escapeText(summary)}`));
    if (activity.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeText(activity.description)}`));
    }
    if (activity.location) {
      lines.push(foldLine(`LOCATION:${escapeText(activity.location)}`));
    }
    lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  const ics = lines.join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agenda-familia.ics"`,
      "Cache-Control": "no-cache, no-store",
    },
  });
}

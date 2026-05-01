export interface ICalEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
}

export async function fetchAndParseICal(url: string): Promise<ICalEvent[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "AgendaFamiliaIA/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Falha ao buscar iCal: ${res.status}`);
  const text = await res.text();
  return parseICal(text);
}

function parseICal(icsContent: string): ICalEvent[] {
  // Unfold folded lines (RFC 5545 §3.1)
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const events: ICalEvent[] = [];
  let inEvent = false;
  let current: Partial<ICalEvent> & { _rawStart?: string; _rawEnd?: string } = {};

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (upper === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
    } else if (upper === "END:VEVENT" && inEvent) {
      if (current.uid && current.summary && current.start) {
        events.push({
          uid: current.uid,
          summary: current.summary,
          description: current.description,
          location: current.location,
          start: current.start,
          end: current.end,
        });
      }
      inEvent = false;
      current = {};
    } else if (inEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      // Key may have parameters: DTSTART;TZID=America/Sao_Paulo:20250101T100000
      const rawKey = line.slice(0, colonIdx);
      const key = rawKey.split(";")[0].toUpperCase();
      const value = line.slice(colonIdx + 1);

      switch (key) {
        case "UID":
          current.uid = value.trim();
          break;
        case "SUMMARY":
          current.summary = unescapeText(value);
          break;
        case "DESCRIPTION":
          current.description = unescapeText(value) || undefined;
          break;
        case "LOCATION":
          current.location = unescapeText(value) || undefined;
          break;
        case "DTSTART": {
          const d = parseICalDate(value.trim(), rawKey);
          if (d) current.start = d;
          break;
        }
        case "DTEND": {
          const d = parseICalDate(value.trim(), rawKey);
          if (d) current.end = d;
          break;
        }
      }
    }
  }

  return events;
}

function parseICalDate(value: string, rawKey: string): Date | null {
  try {
    // Date only: 20250101
    if (/^\d{8}$/.test(value)) {
      return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00-03:00`);
    }
    // UTC datetime: 20250101T100000Z
    if (/^\d{8}T\d{6}Z$/.test(value)) {
      return new Date(
        `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T` +
        `${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`
      );
    }
    // Floating / local datetime: 20250101T100000
    if (/^\d{8}T\d{6}$/.test(value)) {
      // Check for TZID param in key
      const tzidMatch = rawKey.match(/TZID=([^;:]+)/i);
      const suffix = tzidMatch ? "" : "-03:00"; // assume Brasília if no TZ
      return new Date(
        `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T` +
        `${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}${suffix}`
      );
    }
    return null;
  } catch {
    return null;
  }
}

function unescapeText(str: string): string {
  return str
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

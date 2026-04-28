import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface InterpretBody {
  transcript: string;
  familyId: string;
  children: Array<{ id: string; name: string }>;
}

interface ClaudeExtracted {
  title?: unknown;
  childName?: unknown;
  category?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  location?: unknown;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: InterpretBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { transcript, children = [] } = body;
  if (!transcript?.trim()) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY nao configurada" },
      { status: 500 }
    );
  }

  const brazilNow = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const childrenList = children.map((c) => c.name).join(", ") || "nenhum";

  let claudeResponse: Response;
  try {
    claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system:
          `Voce e um assistente que extrai informacoes de atividades familiares de comandos de voz em portugues. ` +
          `Retorne APENAS JSON valido sem markdown, sem bloco de codigo, sem explicacao. ` +
          `Data e hora atual em Brasilia: ${brazilNow}. ` +
          `Retorne startAt e endAt no formato ISO sem timezone (YYYY-MM-DDTHH:mm:ss), usando horario de Brasilia. ` +
          `Se o comando mencionar "toda segunda", "toda terca" etc, use a proxima ocorrencia como startAt.`,
        messages: [
          {
            role: "user",
            content:
              `Filhos cadastrados: ${childrenList}\n\n` +
              `Comando de voz: ${transcript}\n\n` +
              `Retorne JSON com os campos: ` +
              `{"title": string, "childName": string|null, "category": "SCHOOL"|"SPORT"|"MEDICAL"|"OTHER", ` +
              `"startAt": "YYYY-MM-DDTHH:mm:ss"|null, "endAt": "YYYY-MM-DDTHH:mm:ss"|null, "location": string|null}`,
          },
        ],
      }),
    });
  } catch (err) {
    console.error("[voice/interpret] fetch error:", err);
    return NextResponse.json({ error: "Erro de conexao com Claude API" }, { status: 502 });
  }

  if (!claudeResponse.ok) {
    const errText = await claudeResponse.text();
    console.error("[voice/interpret] Claude API error:", errText);
    return NextResponse.json({ error: "Erro ao interpretar comando" }, { status: 502 });
  }

  const claudeData = await claudeResponse.json();
  const rawText: string = claudeData.content?.[0]?.text ?? "";

  // Strip markdown code fences that Claude sometimes adds despite instructions
  const cleanText = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: ClaudeExtracted;
  try {
    parsed = JSON.parse(cleanText);
  } catch {
    console.error("[voice/interpret] parse error. raw:", rawText);
    return NextResponse.json(
      { error: "Nao entendi o comando. Tente novamente." },
      { status: 422 }
    );
  }

  const childName = typeof parsed.childName === "string" ? parsed.childName : null;
  const matchedChild = childName
    ? children.find(
        (c) =>
          c.name.toLowerCase().includes(childName.toLowerCase()) ||
          childName.toLowerCase().includes(c.name.toLowerCase())
      )
    : null;

  return NextResponse.json({
    title: typeof parsed.title === "string" ? parsed.title : "",
    child_id: matchedChild?.id ?? null,
    childName,
    category:
      typeof parsed.category === "string" ? parsed.category : "OTHER",
    startAt: typeof parsed.startAt === "string" ? parsed.startAt : null,
    endAt: typeof parsed.endAt === "string" ? parsed.endAt : null,
    location: typeof parsed.location === "string" ? parsed.location : null,
    transcript,
  });
}

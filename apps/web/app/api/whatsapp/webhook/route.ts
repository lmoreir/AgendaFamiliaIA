import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { WhatsAppService, AIAgentService } from "@agenda-familia/services";
import type { ConversationMessage } from "@agenda-familia/services";
import { prisma } from "@/lib/prisma";
import { redis, RedisKeys, REDIS_TTL } from "@/lib/redis";

const whatsapp = new WhatsAppService();
const aiAgent = new AIAgentService();

const MAX_HISTORY_MESSAGES = 10;

// 554898202532 (12 dígitos) → 5548998202532 (13 dígitos)
function normalizePhoneNumber(phone: string): string {
  if (/^55\d{10}$/.test(phone)) {
    return phone.slice(0, 4) + "9" + phone.slice(4);
  }
  return phone;
}

const MSG_NO_ACCOUNT =
  "Ola! Para usar o Agenda Familia IA, acesse http://localhost:3000 e crie sua conta primeiro.";

const MSG_NO_FAMILY =
  "Sua conta nao possui uma familia cadastrada. Acesse http://localhost:3000 para configurar.";

/**
 * GET /api/whatsapp/webhook
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[WA] Webhook verificado com sucesso");
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 * Responde 200 imediatamente. Processamento ocorre em background.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  const signature = request.headers.get("x-hub-signature-256");
  if (!isValidSignature(body, signature)) {
    console.warn("[WA] Assinatura invalida recebida");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  console.log("[WA] Payload recebido:", JSON.stringify(payload).slice(0, 300));

  processWebhookAsync(payload).catch((err) => {
    console.error("[WA] Erro nao tratado em processWebhookAsync:", err?.message ?? err);
    console.error(err?.stack);
  });

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

function isValidSignature(body: string, signature: string | null): boolean {
  if (!signature || !process.env.WHATSAPP_APP_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
    .update(body)
    .digest("hex");
  const received = signature.replace("sha256=", "");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function processWebhookAsync(payload: unknown): Promise<void> {
  // STEP 1 — parse mensagens
  let messages: ReturnType<typeof whatsapp.parseIncomingMessages>;
  try {
    messages = whatsapp.parseIncomingMessages(payload);
  } catch (err: any) {
    console.error("[WA] STEP 1 FALHOU — parseIncomingMessages:", err?.message);
    return;
  }

  console.log(`[WA] STEP 1 OK — ${messages.length} mensagem(ns) parseada(s):`,
    messages.map((m) => ({ from: m.from, text: m.text, messageId: m.messageId }))
  );

  if (messages.length === 0) {
    console.log("[WA] Nenhuma mensagem de texto no payload (status update ou outro evento). Ignorando.");
    return;
  }

  for (const msg of messages) {
    try {
      await handleIncomingMessage(msg);
    } catch (err: any) {
      console.error(`[WA] Erro ao processar mensagem de ${msg.from}:`, err?.message);
      console.error(err?.stack);
    }
  }
}

async function handleIncomingMessage(msg: {
  messageId: string;
  from: string;
  text: string;
  timestamp: Date;
}): Promise<void> {
  console.log(`\n[WA] === Processando mensagem ===`);
  console.log(`[WA] De: ${msg.from} | ID: ${msg.messageId} | Texto: "${msg.text}"`);

  const normalizedFrom = normalizePhoneNumber(msg.from);
  if (normalizedFrom !== msg.from) {
    console.log(`[WA] Numero normalizado: ${msg.from} -> ${normalizedFrom}`);
  }

  // STEP 2 — busca usuario
  let user: any;
  try {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone_whatsapp: normalizedFrom },
          { phone_whatsapp: `+${normalizedFrom}` },
        ],
      },
      include: { owned_families: { take: 1 } },
    });
  } catch (err: any) {
    console.error("[WA] STEP 2 FALHOU — prisma.user.findFirst:", err?.message);
    throw err;
  }

  if (!user) {
    console.log(`[WA] STEP 2 OK — Numero ${normalizedFrom} NAO encontrado no banco`);
    console.log("[WA] Enviando mensagem de cadastro...");
    await whatsapp.sendText({ to: normalizedFrom, body: MSG_NO_ACCOUNT });
    console.log("[WA] Mensagem de cadastro enviada com sucesso");
    return;
  }

  console.log(`[WA] STEP 2 OK — Usuario encontrado: id=${user.id} email=${user.email}`);
  console.log(`[WA] Familias do usuario: ${user.owned_families?.length ?? 0}`);

  const family = user.owned_families?.[0];
  if (!family) {
    console.log(`[WA] Usuario ${user.id} sem familia. Enviando aviso...`);
    await whatsapp.sendText({ to: normalizedFrom, body: MSG_NO_FAMILY });
    console.log("[WA] Aviso de familia enviado com sucesso");
    return;
  }

  console.log(`[WA] Familia: id=${family.id} nome="${family.name}"`);

  // STEP 3 — historico Redis
  const historyKey = RedisKeys.conversationContext(user.id);
  let history: ConversationMessage[] = [];
  try {
    const raw = await redis.get(historyKey);
    history = raw ? JSON.parse(raw) : [];
    console.log(`[WA] STEP 3 OK — Historico Redis: ${history.length} mensagem(ns)`);
  } catch (err: any) {
    console.warn("[WA] STEP 3 WARN — Erro ao ler Redis, continuando sem historico:", err?.message);
    history = [];
  }

  // STEP 4 — AIAgentService
  console.log("[WA] STEP 4 — Chamando AIAgentService...");
  let result: { response: string; toolsUsed: string[] };
  try {
    result = await aiAgent.processMessage({
      userMessage: msg.text,
      familyId: family.id,
      conversationHistory: history,
    });
  } catch (err: any) {
    console.error("[WA] STEP 4 FALHOU — AIAgentService.processMessage:", err?.message);
    throw err;
  }

  console.log(`[WA] STEP 4 OK — Resposta gerada (${result.response.length} chars), tools: [${result.toolsUsed.join(", ") || "nenhuma"}]`);
  console.log(`[WA] Resposta: "${result.response.slice(0, 120)}${result.response.length > 120 ? "..." : ""}"`);

  // STEP 5 — salvar historico
  try {
    history.push(
      { role: "user",      content: msg.text },
      { role: "assistant", content: result.response }
    );
    if (history.length > MAX_HISTORY_MESSAGES) {
      history = history.slice(history.length - MAX_HISTORY_MESSAGES);
    }
    await redis.setex(historyKey, REDIS_TTL.conversationContext, JSON.stringify(history));
    console.log(`[WA] STEP 5 OK — Historico salvo no Redis (${history.length} msgs, TTL ${REDIS_TTL.conversationContext}s)`);
  } catch (err: any) {
    console.warn("[WA] STEP 5 WARN — Erro ao salvar Redis (nao critico):", err?.message);
  }

  // STEP 6 — enviar resposta
  console.log(`[WA] STEP 6 — Enviando resposta para ${normalizedFrom}...`);
  try {
    await whatsapp.sendText({
      to:               normalizedFrom,
      body:             result.response,
      replyToMessageId: msg.messageId,
    });
    console.log(`[WA] STEP 6 OK — Resposta enviada com sucesso para ${normalizedFrom}`);
  } catch (err: any) {
    console.error("[WA] STEP 6 FALHOU — WhatsAppService.sendText:", err?.message);
    throw err;
  }

  console.log(`[WA] === Mensagem processada com sucesso ===\n`);
}

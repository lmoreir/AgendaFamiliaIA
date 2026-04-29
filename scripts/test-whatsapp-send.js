#!/usr/bin/env node
/**
 * Testa o envio de mensagem para o WhatsApp via API do Meta.
 * Uso: node scripts/test-whatsapp-send.js <numero>
 * Exemplo: node scripts/test-whatsapp-send.js 5548998202532
 */

const fs = require("fs");
const path = require("path");

// Carrega .env.local manualmente
const envPath = path.join(__dirname, "../apps/web/.env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  console.log("✓ .env.local carregado\n");
}

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN;

if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
  console.error("Erro: WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_ACCESS_TOKEN não encontrados no .env.local");
  process.exit(1);
}

const to = process.argv[2];
if (!to) {
  console.error("Uso: node scripts/test-whatsapp-send.js <numero_com_codigo_pais>");
  console.error("Exemplo: node scripts/test-whatsapp-send.js 5548998202532");
  process.exit(1);
}

const body = `🧪 Teste de envio — Agenda Família IA\n${new Date().toLocaleString("pt-BR")}`;

async function main() {
  console.log(`Phone Number ID : ${PHONE_NUMBER_ID}`);
  console.log(`Token (início)  : ${ACCESS_TOKEN.slice(0, 20)}...`);
  console.log(`Destino         : ${to}`);
  console.log(`Mensagem        : "${body}"\n`);

  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body },
  };

  console.log("Enviando...");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();

  if (res.ok) {
    console.log("✅ Mensagem enviada com sucesso!");
    console.log("Resposta da API:", JSON.stringify(json, null, 2));
  } else {
    console.error("❌ Erro ao enviar mensagem");
    console.error("Status HTTP:", res.status);
    console.error("Resposta da API:", JSON.stringify(json, null, 2));
  }
}

main().catch((err) => {
  console.error("Erro inesperado:", err.message);
  process.exit(1);
});

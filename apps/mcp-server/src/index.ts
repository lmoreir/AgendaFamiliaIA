/**
 * Agenda da Família IA — MCP Server
 *
 * Expõe ferramentas que o Claude usa para manipular a agenda
 * durante conversas de WhatsApp.
 *
 * Protocolo: stdin/stdout (padrão MCP)
 * Transporte: pode ser HTTP via SSE para deploy em produção
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { activityTools, handleActivityTool } from "./tools/activity.js";
import { familyTools,   handleFamilyTool }   from "./tools/family.js";
import { reminderTools, handleReminderTool } from "./tools/reminder.js";

// ─── Instanciar servidor MCP ─────────────────────────────
const server = new Server(
  {
    name:    "agenda-familia-ia",
    version: "0.1.0",
  },
  {
    capabilities: { tools: {} },
  }
);

// ─── Registrar todas as ferramentas ─────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      ...activityTools,
      ...familyTools,
      ...reminderTools,
    ],
  };
});

// ─── Dispatcher de chamadas de ferramentas ────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[MCP] Ferramenta chamada: ${name}`);

  // Atividades
  if (name.startsWith("activity_") || name === "get_week_schedule") {
    return handleActivityTool(name, args ?? {});
  }

  // Família e filhos
  if (name.startsWith("family_") || name.startsWith("child_")) {
    return handleFamilyTool(name, args ?? {});
  }

  // Lembretes
  if (name.startsWith("reminder_")) {
    return handleReminderTool(name, args ?? {});
  }

  throw new Error(`Ferramenta desconhecida: ${name}`);
});

// ─── Iniciar servidor ────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] Servidor Agenda da Família IA iniciado");
}

main().catch((err) => {
  console.error("[MCP] Erro fatal:", err);
  process.exit(1);
});

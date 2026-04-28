/**
 * Ferramentas MCP — Lembretes
 */

import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const reminderTools: Tool[] = [
  {
    name: "reminder_create",
    description:
      "Cria um lembrete para uma atividade. Por padrão cria dois lembretes: 1 dia antes e 30 minutos antes. Pode ser customizado pelo usuário.",
    inputSchema: {
      type: "object",
      properties: {
        activity_id:      { type: "string" },
        family_id:        { type: "string" },
        minutes_before:   { type: "number", description: "Minutos antes da atividade para disparar" },
        channels:         {
          type: "array",
          items: { type: "string", enum: ["WHATSAPP", "EMAIL", "PUSH"] },
          description: "Canais de notificação",
        },
      },
      required: ["activity_id", "family_id"],
    },
  },
  {
    name: "reminder_list",
    description: "Lista lembretes pendentes da família.",
    inputSchema: {
      type: "object",
      properties: {
        family_id: { type: "string" },
        status:    { type: "string", enum: ["PENDING", "SENT", "FAILED"] },
      },
      required: ["family_id"],
    },
  },
];

export async function handleReminderTool(
  name: string,
  args: Record<string, unknown>
) {
  switch (name) {
    case "reminder_create": {
      const data = z.object({
        activity_id:    z.string().uuid(),
        family_id:      z.string().uuid(),
        minutes_before: z.number().default(30),
        channels:       z.array(z.enum(["WHATSAPP", "EMAIL", "PUSH"]))
                         .default(["WHATSAPP"]),
      }).parse(args);
      // TODO (Dia 6): chamar ReminderService.create(data)
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            message: `Lembrete criado ${data.minutes_before} minutos antes via ${data.channels.join(", ")}`,
          }),
        }],
      };
    }

    case "reminder_list": {
      const params = z.object({
        family_id: z.string(),
        status:    z.enum(["PENDING", "SENT", "FAILED"]).optional(),
      }).parse(args);
      // TODO (Dia 6): buscar lembretes do DB
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ reminders: [], params }),
        }],
      };
    }

    default:
      throw new Error(`Ferramenta de lembrete desconhecida: ${name}`);
  }
}

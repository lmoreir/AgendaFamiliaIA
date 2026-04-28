/**
 * Ferramentas MCP — Atividades
 * Usadas pelo Claude para criar, listar e gerenciar atividades
 */

import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// ─── Schemas de validação ────────────────────────────────

const CreateActivitySchema = z.object({
  family_id:   z.string().uuid(),
  title:       z.string().min(1).max(200),
  child_id:    z.string().uuid().optional(),
  category:    z.enum(["SCHOOL", "SPORT", "MEDICAL", "OTHER"]).default("OTHER"),
  start_at:    z.string().datetime(),
  end_at:      z.string().datetime().optional(),
  location:    z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
});

const ListActivitiesSchema = z.object({
  family_id: z.string().uuid(),
  from:      z.string().datetime().optional(),
  to:        z.string().datetime().optional(),
  child_id:  z.string().uuid().optional(),
});

const UpdateActivitySchema = z.object({
  activity_id: z.string().uuid(),
  title:       z.string().optional(),
  start_at:    z.string().datetime().optional(),
  end_at:      z.string().datetime().optional(),
  status:      z.enum(["ACTIVE", "CANCELLED", "DONE"]).optional(),
  location:    z.string().optional(),
  description: z.string().optional(),
});

const GetWeekScheduleSchema = z.object({
  family_id:  z.string().uuid(),
  week_start: z.string().datetime().optional(), // padrão: semana atual
});

// ─── Definições das ferramentas ──────────────────────────

export const activityTools: Tool[] = [
  {
    name: "activity_create",
    description:
      "Cria uma nova atividade na agenda da família. Use quando o usuário mencionar algo como 'natação da Ana na sexta às 17h' ou 'consulta do pediatra dia 20 às 10h'.",
    inputSchema: {
      type: "object",
      properties: {
        family_id:   { type: "string", description: "ID da família" },
        title:       { type: "string", description: "Título da atividade (ex: Natação, Consulta pediátrica)" },
        child_id:    { type: "string", description: "ID do filho (opcional)" },
        category:    { type: "string", enum: ["SCHOOL", "SPORT", "MEDICAL", "OTHER"] },
        start_at:    { type: "string", description: "Data e hora de início no formato ISO 8601" },
        end_at:      { type: "string", description: "Data e hora de término (opcional)" },
        location:    { type: "string", description: "Local da atividade (opcional)" },
        description: { type: "string", description: "Detalhes adicionais (opcional)" },
      },
      required: ["family_id", "title", "start_at"],
    },
  },
  {
    name: "activity_list",
    description:
      "Lista atividades da família em um período. Use para responder perguntas como 'o que tem essa semana?' ou 'quais são as atividades do João em maio?'.",
    inputSchema: {
      type: "object",
      properties: {
        family_id: { type: "string" },
        from:      { type: "string", description: "Data início ISO 8601 (opcional, padrão: hoje)" },
        to:        { type: "string", description: "Data fim ISO 8601 (opcional, padrão: 7 dias)" },
        child_id:  { type: "string", description: "Filtrar por filho específico (opcional)" },
      },
      required: ["family_id"],
    },
  },
  {
    name: "activity_update",
    description:
      "Atualiza uma atividade existente. Use quando o usuário quiser remarcar, cancelar ou editar detalhes.",
    inputSchema: {
      type: "object",
      properties: {
        activity_id: { type: "string" },
        title:       { type: "string" },
        start_at:    { type: "string" },
        end_at:      { type: "string" },
        status:      { type: "string", enum: ["ACTIVE", "CANCELLED", "DONE"] },
        location:    { type: "string" },
        description: { type: "string" },
      },
      required: ["activity_id"],
    },
  },
  {
    name: "activity_delete",
    description: "Remove uma atividade da agenda. Peça confirmação ao usuário antes de chamar.",
    inputSchema: {
      type: "object",
      properties: {
        activity_id: { type: "string" },
      },
      required: ["activity_id"],
    },
  },
  {
    name: "get_week_schedule",
    description:
      "Retorna o resumo completo da semana para a família: todas as atividades organizadas por dia. Ideal para gerar uma visão geral quando o usuário perguntar 'como está a semana?'.",
    inputSchema: {
      type: "object",
      properties: {
        family_id:  { type: "string" },
        week_start: { type: "string", description: "Segunda-feira da semana desejada (ISO, opcional)" },
      },
      required: ["family_id"],
    },
  },
];

// ─── Handlers ────────────────────────────────────────────

export async function handleActivityTool(
  name: string,
  args: Record<string, unknown>
) {
  switch (name) {
    case "activity_create": {
      const data = CreateActivitySchema.parse(args);
      // TODO (Dia 5): chamar ActivityService.create(data)
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            message: `Atividade "${data.title}" criada para ${data.start_at}`,
            activity_id: "placeholder-id",
          }),
        }],
      };
    }

    case "activity_list": {
      const params = ListActivitiesSchema.parse(args);
      // TODO (Dia 5): chamar ActivityService.list(params)
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ activities: [], params }),
        }],
      };
    }

    case "activity_update": {
      const data = UpdateActivitySchema.parse(args);
      // TODO (Dia 5): chamar ActivityService.update(data)
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: true, updated: data.activity_id }),
        }],
      };
    }

    case "activity_delete": {
      const { activity_id } = z.object({ activity_id: z.string().uuid() }).parse(args);
      // TODO (Dia 5): chamar ActivityService.delete(activity_id)
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: true, deleted: activity_id }),
        }],
      };
    }

    case "get_week_schedule": {
      const params = GetWeekScheduleSchema.parse(args);
      // TODO (Dia 5): buscar e agrupar atividades por dia
      const weekStart = params.week_start
        ? new Date(params.week_start)
        : getMonday(new Date());

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            week_start: weekStart.toISOString(),
            days: [],
            total_activities: 0,
          }),
        }],
      };
    }

    default:
      throw new Error(`Ferramenta de atividade desconhecida: ${name}`);
  }
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

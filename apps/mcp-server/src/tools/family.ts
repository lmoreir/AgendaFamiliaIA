/**
 * Ferramentas MCP — Família e Filhos
 */

import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const familyTools: Tool[] = [
  {
    name: "family_get_info",
    description:
      "Retorna informações da família (nome, filhos cadastrados, fuso horário). Use no início da conversa para contextualizar quem são os filhos.",
    inputSchema: {
      type: "object",
      properties: {
        family_id: { type: "string" },
      },
      required: ["family_id"],
    },
  },
  {
    name: "child_add",
    description:
      "Adiciona um novo filho à família. Use quando o usuário mencionar um nome de criança que ainda não está cadastrado.",
    inputSchema: {
      type: "object",
      properties: {
        family_id:  { type: "string" },
        name:       { type: "string", description: "Nome do filho" },
        birth_date: { type: "string", description: "Data de nascimento ISO (opcional)" },
        color:      { type: "string", description: "Cor para o calendário (hex, opcional)" },
      },
      required: ["family_id", "name"],
    },
  },
  {
    name: "child_list",
    description: "Lista todos os filhos cadastrados da família.",
    inputSchema: {
      type: "object",
      properties: {
        family_id: { type: "string" },
      },
      required: ["family_id"],
    },
  },
];

export async function handleFamilyTool(
  name: string,
  args: Record<string, unknown>
) {
  switch (name) {
    case "family_get_info": {
      const { family_id } = z.object({ family_id: z.string() }).parse(args);
      // TODO (Dia 5): buscar família e filhos do DB
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            family_id,
            family_name: "Família Silva",
            children: [],
            timezone: "America/Sao_Paulo",
          }),
        }],
      };
    }

    case "child_add": {
      const data = z.object({
        family_id:  z.string(),
        name:       z.string().min(1),
        birth_date: z.string().optional(),
        color:      z.string().optional(),
      }).parse(args);
      // TODO (Dia 5): criar filho no DB
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            message: `${data.name} adicionado(a) à família`,
            child_id: "placeholder-id",
          }),
        }],
      };
    }

    case "child_list": {
      const { family_id } = z.object({ family_id: z.string() }).parse(args);
      // TODO (Dia 5): buscar filhos do DB
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ family_id, children: [] }),
        }],
      };
    }

    default:
      throw new Error(`Ferramenta de família desconhecida: ${name}`);
  }
}

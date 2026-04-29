import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";
import { ActivityService } from "./ActivityService";

const activityService = new ActivityService(prisma);

function buildSystemPrompt(): string {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `Você é o assistente da Agenda Família IA, um ajudante amigável que ajuda pais a gerenciar atividades dos filhos via WhatsApp.

## Data e hora atual
${now} (fuso: America/Sao_Paulo)

## Seu papel
- Interpretar mensagens em linguagem natural em português
- Usar as ferramentas disponíveis para criar, consultar e atualizar a agenda
- Responder de forma breve, clara e com emojis apropriados

## Regras
1. Crie atividades diretamente sem pedir confirmação — após criar, informe o que foi feito
2. Se a data/hora for ambígua, pergunte antes de agir
3. Use linguagem informal e amigável
4. Respostas curtas — máximo 3 parágrafos
5. Ao listar atividades, organize por dia com horário e nome do filho

## Exemplos
- "natação da Ana sexta 17h" → chama activity_create com title="Natação", child_name="Ana", start_at=próxima sexta 17:00
- "o que tem essa semana?" → chama get_week_schedule
- "cancela a consulta de amanhã" → chama activity_update com status=CANCELLED
- "adiciona João nos meus filhos" → chama child_add com name="João"
- "quais são meus filhos?" → chama list_children`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "activity_create",
    description: "Cria uma nova atividade na agenda da família.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Título da atividade" },
        start_at: { type: "string", description: "Data e hora de início no formato ISO 8601 (ex: 2025-04-30T14:00:00)" },
        end_at: { type: "string", description: "Data e hora de término (opcional)" },
        child_name: { type: "string", description: "Nome do filho associado (opcional)" },
        location: { type: "string", description: "Local da atividade (opcional)" },
        category: {
          type: "string",
          enum: ["SCHOOL", "SPORT", "MEDICAL", "OTHER"],
          description: "Categoria da atividade",
        },
        description: { type: "string", description: "Descrição adicional (opcional)" },
      },
      required: ["title", "start_at"],
    },
  },
  {
    name: "activity_update",
    description: "Atualiza ou cancela uma atividade existente. Use title_search para encontrar pelo título.",
    input_schema: {
      type: "object" as const,
      properties: {
        activity_id: { type: "string", description: "ID da atividade (se conhecido)" },
        title_search: { type: "string", description: "Parte do título para localizar a atividade" },
        date_search: { type: "string", description: "Data para filtrar a busca (ISO 8601)" },
        title: { type: "string", description: "Novo título" },
        start_at: { type: "string", description: "Nova data/hora de início (ISO 8601)" },
        end_at: { type: "string", description: "Nova data/hora de término (ISO 8601)" },
        location: { type: "string", description: "Novo local" },
        status: { type: "string", enum: ["ACTIVE", "CANCELLED", "DONE"] },
        description: { type: "string", description: "Nova descrição" },
      },
      required: [],
    },
  },
  {
    name: "get_week_schedule",
    description: "Retorna as atividades da semana da família.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_offset: {
          type: "number",
          description: "0 = semana atual, 1 = próxima semana, -1 = semana passada",
        },
      },
      required: [],
    },
  },
  {
    name: "list_children",
    description: "Lista os filhos cadastrados na família.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "child_add",
    description: "Adiciona um filho à família.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Nome do filho" },
        birth_date: { type: "string", description: "Data de nascimento no formato YYYY-MM-DD (opcional)" },
      },
      required: ["name"],
    },
  },
];

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  familyId: string
): Promise<string> {
  console.log(`[AI] Executando tool: ${toolName}`, JSON.stringify(toolInput));

  try {
    switch (toolName) {
      case "activity_create": {
        let childId: string | undefined;
        if (toolInput.child_name) {
          const children = await prisma.child.findMany({ where: { family_id: familyId } });
          const match = children.find((c) =>
            c.name.toLowerCase().includes((toolInput.child_name as string).toLowerCase())
          );
          if (match) childId = match.id;
        }

        const family = await prisma.family.findUnique({
          where: { id: familyId },
          select: { owner_id: true },
        });
        if (!family) return JSON.stringify({ error: "Família não encontrada" });

        const activity = await activityService.create({
          family_id: familyId,
          child_id: childId,
          created_by: family.owner_id,
          title: toolInput.title as string,
          description: toolInput.description as string | undefined,
          category: (toolInput.category as any) ?? "OTHER",
          start_at: new Date(toolInput.start_at as string),
          end_at: toolInput.end_at ? new Date(toolInput.end_at as string) : undefined,
          location: toolInput.location as string | undefined,
          source: "WHATSAPP",
        });

        return JSON.stringify({
          success: true,
          activity_id: activity.id,
          title: activity.title,
          start_at: activity.start_at,
          child: activity.child?.name ?? null,
          location: activity.location ?? null,
        });
      }

      case "activity_update": {
        let activityId = toolInput.activity_id as string | undefined;

        if (!activityId && (toolInput.title_search || toolInput.date_search)) {
          const where: any = { family_id: familyId };
          if (toolInput.title_search) {
            where.title = { contains: toolInput.title_search as string, mode: "insensitive" };
          }
          if (toolInput.date_search) {
            const date = new Date(toolInput.date_search as string);
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);
            where.start_at = { gte: date, lt: nextDay };
          }
          const found = await prisma.activity.findFirst({ where, orderBy: { start_at: "asc" } });
          if (!found) return JSON.stringify({ error: "Atividade não encontrada com esses critérios" });
          activityId = found.id;
        }

        if (!activityId) return JSON.stringify({ error: "Informe o ID ou o título da atividade para atualizar" });

        const updated = await activityService.update(activityId, {
          title: toolInput.title as string | undefined,
          start_at: toolInput.start_at ? new Date(toolInput.start_at as string) : undefined,
          end_at: toolInput.end_at ? new Date(toolInput.end_at as string) : undefined,
          location: toolInput.location as string | undefined,
          status: toolInput.status as any,
          description: toolInput.description as string | undefined,
        });

        return JSON.stringify({ success: true, activity: { id: updated.id, title: updated.title, status: updated.status, start_at: updated.start_at } });
      }

      case "get_week_schedule": {
        const offset = (toolInput.week_offset as number) ?? 0;
        const monday = getMonday(new Date());
        monday.setDate(monday.getDate() + offset * 7);

        const activities = await activityService.getWeekSchedule(familyId, monday);
        const result = activities.map((a) => ({
          id: a.id,
          title: a.title,
          start_at: a.start_at,
          end_at: a.end_at ?? null,
          child: a.child?.name ?? null,
          location: a.location ?? null,
          status: a.status,
        }));
        return JSON.stringify(result);
      }

      case "list_children": {
        const children = await prisma.child.findMany({
          where: { family_id: familyId },
          orderBy: { name: "asc" },
        });
        return JSON.stringify(children.map((c) => ({ id: c.id, name: c.name })));
      }

      case "child_add": {
        const existing = await prisma.child.findFirst({
          where: {
            family_id: familyId,
            name: { equals: toolInput.name as string, mode: "insensitive" },
          },
        });
        if (existing) return JSON.stringify({ error: `Já existe um filho chamado "${toolInput.name}"` });

        const child = await prisma.child.create({
          data: {
            family_id: familyId,
            name: toolInput.name as string,
            birth_date: toolInput.birth_date ? new Date(toolInput.birth_date as string) : null,
            color: "#3b82f6",
          },
        });
        return JSON.stringify({ success: true, child_id: child.id, name: child.name });
      }

      default:
        return JSON.stringify({ error: `Ferramenta "${toolName}" não reconhecida` });
    }
  } catch (err: any) {
    console.error(`[AI] Erro na tool ${toolName}:`, err?.message);
    return JSON.stringify({ error: err?.message ?? "Erro interno ao executar a ferramenta" });
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

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProcessMessageParams {
  userMessage: string;
  familyId: string;
  conversationHistory: ConversationMessage[];
}

export interface ProcessMessageResult {
  response: string;
  toolsUsed: string[];
}

const MAX_ITERATIONS = 6;

export class AIAgentService {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async processMessage({
    userMessage,
    familyId,
    conversationHistory,
  }: ProcessMessageParams): Promise<ProcessMessageResult> {
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: userMessage,
      },
    ];

    const toolsUsed: string[] = [];
    let iterations = 0;

    let response = await this.client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages,
    });

    console.log(`[AI] Resposta inicial — stop_reason: ${response.stop_reason}`);

    while (response.stop_reason === "tool_use" && iterations < MAX_ITERATIONS) {
      iterations++;
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      console.log(`[AI] Iteração ${iterations}: ${toolUseBlocks.length} tool(s) a executar`);

      // Executa todas as tools em paralelo
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.type !== "tool_use") return null!;
          toolsUsed.push(block.name);
          const result = await executeTool(block.name, block.input as Record<string, unknown>, familyId);
          console.log(`[AI] Tool ${block.name} resultado:`, result.slice(0, 200));
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: result,
          };
        })
      );

      // Adiciona a resposta do assistente e os resultados das tools
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await this.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: buildSystemPrompt(),
        tools: TOOLS,
        messages,
      });

      console.log(`[AI] Iteração ${iterations} — stop_reason: ${response.stop_reason}`);
    }

    const textBlock = response.content.find((b) => b.type === "text");
    const text =
      textBlock && textBlock.type === "text"
        ? textBlock.text
        : "Desculpe, não consegui processar sua mensagem. Pode tentar de novo?";

    return { response: text, toolsUsed };
  }
}

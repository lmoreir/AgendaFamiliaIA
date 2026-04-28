/**
 * AIAgentService
 * Integra o Claude (Anthropic API) com o MCP Server para processar
 * mensagens do WhatsApp e executar ações na agenda da família.
 */

import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Você é o assistente da Agenda da Família IA, um ajudante amigável e organizado que ajuda pais a gerenciar as atividades dos filhos via WhatsApp.

## Seu papel
- Interpretar mensagens em linguagem natural em português
- Extrair informações de atividades (título, data, horário, filho, local)
- Usar as ferramentas disponíveis para criar, consultar e atualizar a agenda
- Responder de forma breve, clara e com emojis apropriados

## Regras importantes
1. Sempre confirme antes de criar uma atividade: "Confirmei: [atividade] dia [data] às [hora]. Correto?"
2. Se a data/hora for ambígua, pergunte antes de agir
3. Use linguagem informal e amigável (você, não o senhor/a senhora)
4. Respostas curtas — máximo 3 parágrafos
5. Sempre inclua o nome do filho quando relevante
6. Ao listar atividades, use uma lista organizada por dia

## Exemplos de interpretação
- "natação da Ana sexta 17h" → activity_create com title="Natação", child="Ana", start_at=próxima sexta 17:00
- "o que tem essa semana?" → get_week_schedule
- "cancela a consulta de amanhã" → activity_update com status=CANCELLED (buscar qual é)
- "adiciona João nos meus filhos" → child_add com name="João"

Fuso horário padrão: America/Sao_Paulo`;

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

export class AIAgentService {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Processa uma mensagem do usuário e retorna a resposta do Claude.
   * O Claude usa as ferramentas do MCP Server para interagir com a agenda.
   */
  async processMessage({
    userMessage,
    familyId,
    conversationHistory,
  }: ProcessMessageParams): Promise<ProcessMessageResult> {
    const messages: Anthropic.MessageParam[] = [
      // Contexto da família injetado no início de cada conversa
      {
        role: "user",
        content: `[CONTEXTO: family_id=${familyId}]\n${userMessage}`,
      },
    ];

    // Inclui histórico da conversa (sem o contexto duplicado)
    if (conversationHistory.length > 0) {
      messages.unshift(
        ...conversationHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    }

    const toolsUsed: string[] = [];

    // Agentic loop — Claude pode chamar múltiplas ferramentas
    let response = await this.client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages,
      // TODO (Dia 5): adicionar tools do MCP Server aqui
      // tools: mcpTools,
    });

    // Se Claude usou ferramentas, processa e continua
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use"
      );

      for (const block of toolUseBlocks) {
        if (block.type === "tool_use") {
          toolsUsed.push(block.name);
          // TODO (Dia 5): chamar MCP Server e retornar resultado
        }
      }

      // Por ora, encerra o loop
      break;
    }

    // Extrai texto da resposta
    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "Desculpe, não entendi. Pode repetir?";

    return { response: text, toolsUsed };
  }
}

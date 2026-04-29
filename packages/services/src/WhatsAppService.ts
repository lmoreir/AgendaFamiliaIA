/**
 * WhatsAppService
 * Abstrai toda comunicação com a WhatsApp Business API (Meta Cloud API).
 * Responsável por: enviar mensagens, parsear webhooks, gerenciar templates.
 */

export interface SendTextMessageParams {
  to: string;      // número no formato E.164: +5511999999999
  body: string;
  replyToMessageId?: string;
}

export interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: unknown[];
}

export class WhatsAppService {
  private readonly baseUrl: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    this.accessToken   = process.env.WHATSAPP_ACCESS_TOKEN!;
    this.baseUrl = `https://graph.facebook.com/v20.0/${this.phoneNumberId}`;
  }

  /**
   * Envia mensagem de texto simples
   */
  async sendText({ to, body, replyToMessageId }: SendTextMessageParams): Promise<unknown> {
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type:    "individual",
      to,
      type: "text",
      text: { body },
    };

    if (replyToMessageId) {
      payload.context = { message_id: replyToMessageId };
    }

    return this.request("messages", "POST", payload);
  }

  /**
   * Envia mensagem usando template aprovado pela Meta
   * (necessário para mensagens iniciadas pelo negócio)
   */
  async sendTemplate({
    to,
    templateName,
    languageCode = "pt_BR",
    components = [],
  }: SendTemplateMessageParams): Promise<void> {
    await this.request("messages", "POST", {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    });
  }

  /**
   * Envia lembrete de atividade formatado
   */
  async sendActivityReminder(params: {
    to: string;
    activityTitle: string;
    childName?: string;
    startAt: Date;
    location?: string;
    minutesBefore: number;
  }): Promise<void> {
    const timeStr = params.startAt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateStr = params.startAt.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    const who = params.childName ? ` do(a) ${params.childName}` : "";
    const when = params.minutesBefore < 60
      ? `em ${params.minutesBefore} minutos`
      : `em ${Math.round(params.minutesBefore / 60)} hora(s)`;

    let body = `🔔 *Lembrete${who}*\n\n`;
    body += `📅 *${params.activityTitle}*\n`;
    body += `⏰ ${dateStr} às ${timeStr}\n`;
    if (params.location) body += `📍 ${params.location}\n`;
    body += `\n_Começa ${when}_`;

    await this.sendText({ to: params.to, body });
  }

  /**
   * Extrai mensagens de texto de um payload de webhook
   */
  parseIncomingMessages(payload: unknown): Array<{
    messageId: string;
    from: string;
    text: string;
    timestamp: Date;
  }> {
    const messages: Array<{
      messageId: string;
      from: string;
      text: string;
      timestamp: Date;
    }> = [];

    const p = payload as Record<string, unknown>;
    const entries = p.entry as unknown[];
    if (!entries) return messages;

    for (const entry of entries) {
      const e = entry as Record<string, unknown>;
      const changes = e.changes as unknown[];
      if (!changes) continue;

      for (const change of changes) {
        const c = change as Record<string, unknown>;
        const value = c.value as Record<string, unknown>;
        const incoming = value?.messages as unknown[];
        if (!incoming) continue;

        for (const msg of incoming) {
          const m = msg as Record<string, unknown>;
          if (m.type !== "text") continue;

          const textObj = m.text as Record<string, unknown>;
          messages.push({
            messageId: m.id as string,
            from:      m.from as string,
            text:      textObj.body as string,
            timestamp: new Date(parseInt(m.timestamp as string) * 1000),
          });
        }
      }
    }

    return messages;
  }

  private async request(
    endpoint: string,
    method: "GET" | "POST",
    body?: unknown
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method,
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${this.accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error ${response.status}: ${error}`);
    }

    return response.json();
  }
}

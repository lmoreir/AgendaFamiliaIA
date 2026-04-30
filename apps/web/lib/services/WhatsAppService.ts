export interface SendTextMessageParams {
  to: string;
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

  parseIncomingMessages(payload: unknown): Array<{
    messageId: string;
    from: string;
    text: string;
    audioMediaId?: string;
    audioUrl?: string;
    audioMime?: string;
    timestamp: Date;
  }> {
    const messages: Array<{
      messageId: string;
      from: string;
      text: string;
      audioMediaId?: string;
      audioUrl?: string;
      audioMime?: string;
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

          if (m.type === "text") {
            const textObj = m.text as Record<string, unknown>;
            messages.push({
              messageId: m.id as string,
              from:      m.from as string,
              text:      textObj.body as string,
              timestamp: new Date(parseInt(m.timestamp as string) * 1000),
            });
          } else if (m.type === "audio") {
            const audioObj = m.audio as Record<string, unknown>;
            messages.push({
              messageId:    m.id as string,
              from:         m.from as string,
              text:         "",
              audioMediaId: audioObj?.id as string,
              audioUrl:     audioObj?.url as string | undefined,
              audioMime:    audioObj?.mime_type as string | undefined,
              timestamp:    new Date(parseInt(m.timestamp as string) * 1000),
            });
          }
        }
      }
    }

    return messages;
  }

  async downloadMedia(
    mediaId: string,
    directUrl?: string,
    mimeTypeHint?: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    let downloadUrl = directUrl;
    let mimeType = mimeTypeHint || "audio/ogg";

    if (!downloadUrl) {
      // Busca metadados apenas se não tiver a URL direta do payload
      const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!metaRes.ok) throw new Error(`Falha ao buscar metadados da mídia: ${metaRes.status}`);
      const meta = await metaRes.json() as Record<string, unknown>;
      downloadUrl = meta.url as string;
      mimeType = (meta.mime_type as string) || mimeType;
    }

    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`Falha ao baixar mídia: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mimeType };
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

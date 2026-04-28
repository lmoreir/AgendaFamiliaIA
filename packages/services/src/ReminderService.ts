/**
 * ReminderService
 * Gerencia criação e disparo de lembretes automáticos.
 * Chamado pelo Vercel Cron a cada 15 minutos.
 */

export interface CreateReminderInput {
  activity_id:    string;
  family_id:      string;
  trigger_at:     Date;
  channels:       ("WHATSAPP" | "EMAIL" | "PUSH")[];
}

export interface ProcessRemindersResult {
  processed: number;
  sent:      number;
  failed:    number;
}

export class ReminderService {
  /**
   * Cria lembretes padrão para uma atividade (30min e 1 dia antes).
   * Chamado automaticamente pelo ActivityService.create()
   */
  async createDefault(activityId: string, familyId: string, startAt: Date) {
    const reminders: CreateReminderInput[] = [
      {
        activity_id: activityId,
        family_id:   familyId,
        trigger_at:  new Date(startAt.getTime() - 30 * 60 * 1000),   // 30 min antes
        channels:    ["WHATSAPP"],
      },
      {
        activity_id: activityId,
        family_id:   familyId,
        trigger_at:  new Date(startAt.getTime() - 24 * 60 * 60 * 1000), // 1 dia antes
        channels:    ["WHATSAPP"],
      },
    ];

    for (const r of reminders) {
      if (r.trigger_at > new Date()) {
        await this.create(r);
      }
    }
  }

  async create(input: CreateReminderInput) {
    // TODO (Dia 6): implementar com Prisma
    console.log("[ReminderService] Criar lembrete:", input.activity_id, input.trigger_at);
  }

  /**
   * Processa lembretes pendentes — chamado pelo cron job a cada 15 min.
   * Busca lembretes com trigger_at <= now + 5min e status=PENDING.
   */
  async processPending(): Promise<ProcessRemindersResult> {
    const result: ProcessRemindersResult = { processed: 0, sent: 0, failed: 0 };

    // TODO (Dia 6): implementar
    // 1. buscar reminders PENDING com trigger_at <= now + 5min
    // 2. para cada um: enviar pelo canal (WhatsApp/email)
    // 3. marcar como SENT ou FAILED
    // 4. usar Redis lock para evitar duplicata

    console.log("[ReminderService] Processando lembretes pendentes...");
    return result;
  }
}

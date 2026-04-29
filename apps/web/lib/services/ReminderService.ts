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
  async createDefault(activityId: string, familyId: string, startAt: Date) {
    const reminders: CreateReminderInput[] = [
      {
        activity_id: activityId,
        family_id:   familyId,
        trigger_at:  new Date(startAt.getTime() - 30 * 60 * 1000),
        channels:    ["WHATSAPP"],
      },
      {
        activity_id: activityId,
        family_id:   familyId,
        trigger_at:  new Date(startAt.getTime() - 24 * 60 * 60 * 1000),
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
    console.log("[ReminderService] Criar lembrete:", input.activity_id, input.trigger_at);
  }

  async processPending(): Promise<ProcessRemindersResult> {
    const result: ProcessRemindersResult = { processed: 0, sent: 0, failed: 0 };
    console.log("[ReminderService] Processando lembretes pendentes...");
    return result;
  }
}

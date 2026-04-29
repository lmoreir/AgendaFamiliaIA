import type {
  Activity,
  Child,
  ActivityCategory,
  ActivityStatus,
  ActivitySource,
} from "../types";

interface IActivityDB {
  activity: {
    findMany(args: any): Promise<any[]>;
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    delete(args: any): Promise<any>;
    findUnique(args: any): Promise<any | null>;
  };
  reminder: {
    createMany(args: any): Promise<{ count: number }>;
  };
}

function toChild(record: any): Child {
  return {
    id: record.id,
    family_id: record.family_id,
    name: record.name,
    birth_date: record.birth_date ?? undefined,
    color: record.color,
    avatar_url: record.avatar_url ?? undefined,
  };
}

function toActivity(record: any): Activity {
  return {
    id: record.id,
    family_id: record.family_id,
    child_id: record.child_id ?? undefined,
    created_by: record.created_by,
    title: record.title,
    description: record.description ?? undefined,
    category: record.category as ActivityCategory,
    start_at: record.start_at,
    end_at: record.end_at ?? undefined,
    location: record.location ?? undefined,
    recurrence: record.recurrence ?? undefined,
    source: record.source as ActivitySource,
    status: record.status as ActivityStatus,
    created_at: record.created_at,
    updated_at: record.updated_at,
    child: record.child ? toChild(record.child) : undefined,
  };
}

export interface CreateActivityInput {
  family_id: string;
  child_id?: string;
  created_by: string;
  title: string;
  description?: string;
  category?: ActivityCategory;
  start_at: Date;
  end_at?: Date;
  location?: string;
  recurrence?: object;
  source?: ActivitySource;
  status?: ActivityStatus;
}

export interface ListActivitiesInput {
  family_id: string;
  from?: Date;
  to?: Date;
  child_id?: string;
  status?: ActivityStatus;
}

export class ActivityService {
  constructor(private readonly db: IActivityDB) {}

  async create(input: CreateActivityInput): Promise<Activity> {
    const record = await this.db.activity.create({
      data: {
        family_id: input.family_id,
        child_id: input.child_id ?? null,
        created_by: input.created_by,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? "OTHER",
        start_at: input.start_at,
        end_at: input.end_at ?? null,
        location: input.location ?? null,
        recurrence: input.recurrence ?? undefined,
        source: input.source ?? "WEB",
        status: input.status ?? "ACTIVE",
      },
      include: { child: true },
    });

    await this.scheduleDefaultReminders(
      record.id,
      input.family_id,
      input.start_at
    );

    return toActivity(record);
  }

  async list(input: ListActivitiesInput): Promise<Activity[]> {
    const where: any = {
      family_id: input.family_id,
      status: input.status ?? "ACTIVE",
    };

    if (input.from || input.to) {
      where.start_at = {};
      if (input.from) where.start_at.gte = input.from;
      if (input.to) where.start_at.lte = input.to;
    }

    if (input.child_id) {
      where.child_id = input.child_id;
    }

    const records = await this.db.activity.findMany({
      where,
      include: { child: true },
      orderBy: { start_at: "asc" },
    });

    return records.map(toActivity);
  }

  async update(
    activityId: string,
    data: Partial<CreateActivityInput> & { status?: ActivityStatus }
  ): Promise<Activity> {
    const patch: any = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.category !== undefined) patch.category = data.category;
    if (data.start_at !== undefined) patch.start_at = data.start_at;
    if (data.end_at !== undefined) patch.end_at = data.end_at;
    if (data.location !== undefined) patch.location = data.location;
    if ("child_id" in data) patch.child_id = data.child_id ?? null;
    if (data.recurrence !== undefined) patch.recurrence = data.recurrence;
    if (data.status !== undefined) patch.status = data.status;

    const record = await this.db.activity.update({
      where: { id: activityId },
      data: patch,
      include: { child: true },
    });

    return toActivity(record);
  }

  async delete(activityId: string): Promise<void> {
    await this.db.activity.delete({ where: { id: activityId } });
  }

  async getWeekSchedule(
    familyId: string,
    weekStart?: Date
  ): Promise<Activity[]> {
    const start = weekStart ?? this.getMonday(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return this.list({ family_id: familyId, from: start, to: end });
  }

  private async scheduleDefaultReminders(
    activityId: string,
    familyId: string,
    startAt: Date
  ): Promise<void> {
    const now = new Date();
    const reminders: any[] = [];

    const thirtyMin = new Date(startAt.getTime() - 30 * 60 * 1000);
    const oneDay = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);

    if (thirtyMin > now) {
      reminders.push({
        activity_id: activityId,
        family_id: familyId,
        trigger_at: thirtyMin,
        channels: ["WHATSAPP"],
        status: "PENDING",
      });
    }
    if (oneDay > now) {
      reminders.push({
        activity_id: activityId,
        family_id: familyId,
        trigger_at: oneDay,
        channels: ["WHATSAPP"],
        status: "PENDING",
      });
    }

    if (reminders.length > 0) {
      await this.db.reminder.createMany({ data: reminders });
    }
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

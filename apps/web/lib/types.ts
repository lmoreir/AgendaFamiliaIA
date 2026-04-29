export type Plan = "FREE" | "BASIC" | "PRO";
export type FamilyRole = "OWNER" | "PARENT" | "VIEWER";
export type ActivityCategory = "SCHOOL" | "SPORT" | "MEDICAL" | "OTHER";
export type ActivityStatus = "ACTIVE" | "CANCELLED" | "DONE";
export type ActivitySource = "WHATSAPP" | "WEB" | "AI";
export type ReminderChannel = "WHATSAPP" | "EMAIL" | "PUSH";
export type ReminderStatus = "PENDING" | "SENT" | "FAILED";

export interface User {
  id: string;
  email: string;
  name: string;
  phone_whatsapp?: string;
  whatsapp_verified: boolean;
  plan: Plan;
  created_at: Date;
  updated_at: Date;
}

export interface Family {
  id: string;
  owner_id: string;
  name: string;
  timezone: string;
  locale: string;
  settings: FamilySettings;
  created_at: Date;
  updated_at: Date;
  children?: Child[];
  members?: FamilyMember[];
}

export interface FamilySettings {
  reminder_default_minutes: number;
  notification_channels: ReminderChannel[];
  week_start: 0 | 1;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id?: string;
  role: FamilyRole;
  phone_whatsapp?: string;
  invited_email?: string;
}

export interface Child {
  id: string;
  family_id: string;
  name: string;
  birth_date?: Date;
  color: string;
  avatar_url?: string;
}

export interface Activity {
  id: string;
  family_id: string;
  child_id?: string;
  created_by: string;
  title: string;
  description?: string;
  category: ActivityCategory;
  start_at: Date;
  end_at?: Date;
  location?: string;
  recurrence?: ActivityRecurrence;
  source: ActivitySource;
  status: ActivityStatus;
  created_at: Date;
  updated_at: Date;
  child?: Child;
}

export interface ActivityRecurrence {
  type: "daily" | "weekly" | "monthly";
  days?: number[];
  day_of_month?: number;
  until?: string;
  interval?: number;
}

export interface Reminder {
  id: string;
  activity_id: string;
  family_id: string;
  trigger_at: Date;
  channels: ReminderChannel[];
  status: ReminderStatus;
  sent_at?: Date;
  error_msg?: string;
  activity?: Activity;
}

export interface CreateFamilyDTO {
  name: string;
  timezone?: string;
}

export interface CreateChildDTO {
  family_id: string;
  name: string;
  birth_date?: string;
  color?: string;
}

export interface CreateActivityDTO {
  family_id: string;
  child_id?: string;
  title: string;
  description?: string;
  category?: ActivityCategory;
  start_at: string;
  end_at?: string;
  location?: string;
  recurrence?: ActivityRecurrence;
}

export interface UpdateActivityDTO extends Partial<CreateActivityDTO> {
  status?: ActivityStatus;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "audio" | "image" | "interactive";
  text?: { body: string };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        messages?: WhatsAppMessage[];
        statuses?: Array<{ id: string; status: string; timestamp: string }>;
      };
      field: string;
    }>;
  }>;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

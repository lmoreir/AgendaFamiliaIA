/**
 * Tipos compartilhados do Agenda da Família IA
 * Usados pelo app Next.js, MCP Server e services
 */

// ─────────────────────────────────────────
// Enums (espelham o Prisma schema)
// ─────────────────────────────────────────

export type Plan = "FREE" | "BASIC" | "PRO";
export type FamilyRole = "OWNER" | "PARENT" | "VIEWER";
export type ActivityCategory = "SCHOOL" | "SPORT" | "MEDICAL" | "OTHER";
export type ActivityStatus = "ACTIVE" | "CANCELLED" | "DONE";
export type ActivitySource = "WHATSAPP" | "WEB" | "AI";
export type ReminderChannel = "WHATSAPP" | "EMAIL" | "PUSH";
export type ReminderStatus = "PENDING" | "SENT" | "FAILED";

// ─────────────────────────────────────────
// Entidades do domínio
// ─────────────────────────────────────────

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
  reminder_default_minutes: number;  // padrão: 30
  notification_channels: ReminderChannel[];
  week_start: 0 | 1;  // 0 = domingo, 1 = segunda
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
  days?: number[];     // dias da semana (0-6) para type=weekly
  day_of_month?: number; // dia do mês para type=monthly
  until?: string;      // data fim ISO
  interval?: number;   // a cada N dias/semanas/meses
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

// ─────────────────────────────────────────
// DTOs (Data Transfer Objects para APIs)
// ─────────────────────────────────────────

export interface CreateFamilyDTO {
  name: string;
  timezone?: string;
}

export interface CreateChildDTO {
  family_id: string;
  name: string;
  birth_date?: string;  // ISO date
  color?: string;
}

export interface CreateActivityDTO {
  family_id: string;
  child_id?: string;
  title: string;
  description?: string;
  category?: ActivityCategory;
  start_at: string;    // ISO datetime
  end_at?: string;
  location?: string;
  recurrence?: ActivityRecurrence;
}

export interface UpdateActivityDTO extends Partial<CreateActivityDTO> {
  status?: ActivityStatus;
}

// ─────────────────────────────────────────
// WhatsApp / Webhook
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// Respostas da API
// ─────────────────────────────────────────

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

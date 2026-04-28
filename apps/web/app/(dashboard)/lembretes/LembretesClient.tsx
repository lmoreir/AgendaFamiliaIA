"use client";

import { useState } from "react";

interface ReminderChild {
  id: string;
  name: string;
  color: string;
}

interface ReminderActivity {
  id: string;
  title: string;
  start_at: string;
  category: string;
  child: ReminderChild | null;
}

interface Reminder {
  id: string;
  trigger_at: string;
  channels: string[];
  status: string;
  sent_at: string | null;
  activity: ReminderActivity;
}

interface LembretesClientProps {
  initialReminders: Reminder[];
  familyId: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  PUSH: "Notificacao",
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pendente", className: "bg-yellow-100 text-yellow-800" },
  SENT: { label: "Enviado", className: "bg-green-100 text-green-800" },
  FAILED: { label: "Falhou", className: "bg-red-100 text-red-800" },
};

function formatRelative(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const past = diff < 0;

  const mins = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  let rel: string;
  if (mins < 1) rel = "agora";
  else if (mins < 60) rel = `${mins} min`;
  else if (hours < 24) rel = `${hours}h`;
  else rel = `${days} dia${days > 1 ? "s" : ""}`;

  const abs = target.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return past ? `Ha ${rel} (${abs})` : `Em ${rel} — ${abs}`;
}

const CATEGORY_COLOR: Record<string, string> = {
  SCHOOL: "text-blue-600",
  SPORT: "text-green-600",
  MEDICAL: "text-red-600",
  OTHER: "text-gray-600",
};

export function LembretesClient({ initialReminders, familyId }: LembretesClientProps) {
  const [reminders, setReminders] = useState(initialReminders);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);
  const [fireResult, setFireResult] = useState<string | null>(null);

  async function handleFireNow() {
    setFiring(true);
    setFireResult(null);
    try {
      const res = await fetch("/api/cron/reminders");
      const data = await res.json();
      if (res.ok) {
        setFireResult(
          data.sent > 0
            ? `${data.sent} lembrete(s) enviado(s) por email!`
            : data.processed === 0
            ? "Nenhum lembrete pendente para disparar agora."
            : "Lembretes processados mas nenhum email enviado."
        );
        // Atualiza status dos lembretes na tela sem reload
        setReminders((prev) =>
          prev.map((r) => {
            if (r.status === "PENDING" && new Date(r.trigger_at) <= new Date(Date.now() + 10 * 60 * 1000)) {
              return { ...r, status: data.sent > 0 ? "SENT" : "FAILED" };
            }
            return r;
          })
        );
      } else {
        setFireResult("Erro ao disparar lembretes.");
      }
    } catch {
      setFireResult("Erro de conexao.");
    } finally {
      setFiring(false);
      setTimeout(() => setFireResult(null), 6000);
    }
  }

  const pending = reminders.filter((r) => r.status === "PENDING" && new Date(r.trigger_at) > new Date());
  const past = reminders.filter((r) => r.status !== "PENDING" || new Date(r.trigger_at) <= new Date());

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reminders?id=${id}`, { method: "DELETE" });
      if (res.ok) setReminders((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function ReminderCard({ reminder }: { reminder: Reminder }) {
    const status = STATUS_LABEL[reminder.status] ?? STATUS_LABEL.PENDING;
    const catColor = CATEGORY_COLOR[reminder.activity.category] ?? CATEGORY_COLOR.OTHER;

    return (
      <div className="card flex items-start gap-4 p-4">
        <div
          className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
          style={
            reminder.activity.child
              ? { backgroundColor: reminder.activity.child.color }
              : { backgroundColor: "#94a3b8" }
          }
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-gray-900 truncate">
                {reminder.activity.title}
              </p>
              {reminder.activity.child && (
                <p className="text-xs text-gray-500">{reminder.activity.child.name}</p>
              )}
            </div>
            <span
              className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
            >
              {status.label}
            </span>
          </div>

          <p className="mt-1 text-xs text-gray-500">
            {formatRelative(reminder.trigger_at)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {reminder.channels.map((ch) => (
              <span
                key={ch}
                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {CHANNEL_LABEL[ch] ?? ch}
              </span>
            ))}
            <span className={`text-xs font-medium ${catColor}`}>
              {reminder.activity.category}
            </span>
          </div>
        </div>

        {reminder.status === "PENDING" && (
          <button
            onClick={() => handleDelete(reminder.id)}
            disabled={deletingId === reminder.id}
            className="flex-shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
            title="Cancelar lembrete"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }

  const FireButton = () => (
    <div className="flex items-center gap-3">
      <button
        onClick={handleFireNow}
        disabled={firing}
        className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60"
      >
        {firing ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
        Disparar agora
      </button>
      {fireResult && (
        <span className="text-sm text-gray-600">{fireResult}</span>
      )}
    </div>
  );

  if (reminders.length === 0) {
    return (
      <div className="space-y-4">
        <FireButton />
        <div className="card">
          <div className="card-body flex flex-col items-center justify-center py-16 text-center">
            <svg
              className="mb-3 h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <h3 className="font-semibold text-gray-900">Sem lembretes configurados</h3>
            <p className="mt-1 text-sm text-gray-500">
              Os lembretes sao criados automaticamente quando voce adiciona atividades
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FireButton />
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Proximos ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((r) => (
              <ReminderCard key={r.id} reminder={r} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Historico ({past.length})
          </h2>
          <div className="space-y-2">
            {past.map((r) => (
              <ReminderCard key={r.id} reminder={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

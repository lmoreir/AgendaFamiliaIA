"use client";

import { useState, useEffect, useCallback } from "react";
import { ActivityModal } from "../../../components/activity/ActivityModal";
import { VoiceButton } from "../../../components/activity/VoiceButton";
import { CategoryBadge } from "../../../components/ui/Badge";
import type { ActivityCategory } from "../../../lib/types";

interface SerializedChild {
  id: string;
  family_id: string;
  name: string;
  color: string;
  birth_date?: string | null;
  avatar_url?: string | null;
}

interface SerializedActivity {
  id: string;
  family_id: string;
  child_id?: string | null;
  created_by: string;
  title: string;
  description?: string | null;
  category: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  child?: SerializedChild | null;
}

interface WeeklyCalendarProps {
  familyId: string;
  userId: string;
  children: SerializedChild[];
}

interface VoiceResult {
  title: string;
  child_id: string | null;
  childName: string | null;
  category: string;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  transcript: string;
}

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const s = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const e = end.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${s} - ${e}`;
}

function isoToTime(iso: string): string {
  const match = iso.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function buildToastMessage(result: VoiceResult): string {
  const parts: string[] = [];
  if (result.title) parts.push(result.title);
  if (result.childName) parts.push(`para ${result.childName}`);
  if (result.startAt) {
    parts.push(
      new Date(result.startAt).toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
    );
    parts.push(`as ${isoToTime(result.startAt)}`);
  }
  return parts.length > 0
    ? `Entendi: ${parts.join(", ")}`
    : `Entendi: ${result.transcript}`;
}

function ActivityCard({
  activity,
  child,
  onClick,
}: {
  activity: SerializedActivity;
  child?: SerializedChild;
  onClick: () => void;
}) {
  const time = new Date(activity.start_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-gray-100 bg-white p-2 text-xs shadow-sm hover:shadow-md transition-shadow"
      style={
        child
          ? { borderLeftColor: child.color, borderLeftWidth: 3 }
          : undefined
      }
    >
      <p className="font-medium text-gray-900 truncate">{activity.title}</p>
      <p className="text-gray-400">{time}</p>
      {child && (
        <p className="mt-0.5 truncate text-gray-500">{child.name}</p>
      )}
      <div className="mt-1">
        <CategoryBadge category={activity.category as ActivityCategory} />
      </div>
    </button>
  );
}

export function WeeklyCalendar({
  familyId,
  userId,
  children,
}: WeeklyCalendarProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [activities, setActivities] = useState<SerializedActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] =
    useState<SerializedActivity | null>(null);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(
    null
  );

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const weekEnd = addDays(weekStart, 6);
      weekEnd.setHours(23, 59, 59, 999);
      const params = new URLSearchParams({
        familyId,
        from: weekStart.toISOString(),
        to: weekEnd.toISOString(),
      });
      const res = await fetch(`/api/activities?${params}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [familyId, weekStart]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  function showToast(message: string, isError = false) {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 5000);
  }

  function openCreate() {
    setEditingActivity(null);
    setModalOpen(true);
  }

  function openEdit(activity: SerializedActivity) {
    setEditingActivity(activity);
    setModalOpen(true);
  }

  async function handleVoiceResult(transcript: string): Promise<void> {
    const interpretRes = await fetch("/api/voice/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        familyId,
        children: children.map((c) => ({ id: c.id, name: c.name })),
      }),
    });

    if (!interpretRes.ok) {
      const data = await interpretRes.json().catch(() => ({}));
      showToast(
        (data as { error?: string }).error ?? "Nao entendi o comando. Tente novamente.",
        true
      );
      return;
    }

    const result: VoiceResult = await interpretRes.json();

    if (!result.startAt) {
      showToast("Nao entendi o horario. Tente novamente.", true);
      return;
    }

    const startDate = new Date(result.startAt);
    const endDate = result.endAt
      ? new Date(result.endAt)
      : new Date(startDate.getTime() + 60 * 60 * 1000);

    const saveRes = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        family_id: familyId,
        child_id: result.child_id || undefined,
        title: result.title || transcript,
        category: result.category || "OTHER",
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        location: result.location || undefined,
      }),
    });

    if (!saveRes.ok) {
      const data = await saveRes.json().catch(() => ({}));
      showToast(
        (data as { error?: string }).error ?? "Erro ao salvar atividade.",
        true
      );
      return;
    }

    await fetchActivities();
    showToast(buildToastMessage(result));
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance("Atividade cadastrada com sucesso");
      utterance.lang = "pt-BR";
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  const activitiesByDay = weekDays.reduce<Record<string, SerializedActivity[]>>(
    (acc, day) => {
      const key = day.toISOString().split("T")[0];
      acc[key] = activities.filter(
        (a) => new Date(a.start_at).toISOString().split("T")[0] === key
      );
      return acc;
    },
    {}
  );

  const childrenMap = new Map(children.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Agenda da semana</h1>
          <p className="mt-1 text-sm text-gray-500">
            Visualize e gerencie as atividades de toda a familia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VoiceButton onResult={handleVoiceResult} />
          <button className="btn-primary" onClick={openCreate}>
            + Nova atividade
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="card p-5">
          <p className="text-2xl font-bold text-gray-900">{activities.length}</p>
          <p className="text-xs text-gray-500">Atividades esta semana</p>
        </div>
        <div className="card p-5">
          <p className="text-2xl font-bold text-gray-900">0</p>
          <p className="text-xs text-gray-500">Lembretes pendentes</p>
        </div>
        <div className="card p-5">
          <p className="text-2xl font-bold text-gray-900">{children.length}</p>
          <p className="text-xs text-gray-500">Filhos cadastrados</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {formatWeekRange(weekStart)}
            </h2>
            <div className="flex gap-1">
              <button
                className="btn-ghost px-3 py-1 text-xs"
                onClick={() => setWeekStart((w) => addDays(w, -7))}
              >
                Anterior
              </button>
              <button
                className="btn-ghost px-3 py-1 text-xs"
                onClick={() => setWeekStart(getMonday(new Date()))}
              >
                Hoje
              </button>
              <button
                className="btn-ghost px-3 py-1 text-xs"
                onClick={() => setWeekStart((w) => addDays(w, 7))}
              >
                Proximo
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg
              className="h-6 w-6 animate-spin text-brand-600"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <div className="grid min-w-[560px] grid-cols-7 divide-x divide-gray-100">
            {weekDays.map((day, i) => {
              const key = day.toISOString().split("T")[0];
              const dayActivities = activitiesByDay[key] ?? [];
              const isToday = isSameDay(day, today);

              return (
                <div key={key} className="min-h-48 p-2">
                  <div className="mb-2 text-center">
                    <p className="text-xs font-medium uppercase text-gray-400">
                      {DAY_NAMES[i]}
                    </p>
                    <p
                      className={[
                        "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                        isToday
                          ? "bg-brand-600 text-white"
                          : "text-gray-900",
                      ].join(" ")}
                    >
                      {day.getDate()}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {dayActivities.map((activity) => {
                      const child = activity.child_id
                        ? childrenMap.get(activity.child_id)
                        : undefined;
                      return (
                        <ActivityCard
                          key={activity.id}
                          activity={activity}
                          child={child}
                          onClick={() => openEdit(activity)}
                        />
                      );
                    })}
                    <button
                      onClick={openCreate}
                      className="w-full rounded-lg border border-dashed border-gray-200 py-1.5 text-xs text-gray-300 hover:border-brand-300 hover:text-brand-400 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}
      </div>

      <ActivityModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchActivities}
        activity={editingActivity}
        children={children}
        familyId={familyId}
      />

      {toast && (
        <div
          className={[
            "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm text-white shadow-lg",
            toast.isError ? "bg-red-600" : "bg-gray-900",
          ].join(" ")}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

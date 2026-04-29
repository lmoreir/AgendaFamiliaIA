"use client";

import { useState, useEffect } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

interface ChildOption {
  id: string;
  name: string;
  color: string;
}

interface ActivityData {
  id: string;
  title: string;
  child_id?: string | null;
  category: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  description?: string | null;
  family_id: string;
}

export interface ActivityPrefill {
  title?: string;
  child_id?: string;
  category?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
}

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  activity?: ActivityData | null;
  prefill?: ActivityPrefill | null;
  children: ChildOption[];
  familyId: string;
}

interface FormState {
  title: string;
  child_id: string;
  category: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
}

const CATEGORY_OPTIONS = [
  { value: "SCHOOL", label: "Escola" },
  { value: "SPORT", label: "Esporte" },
  { value: "MEDICAL", label: "Saude" },
  { value: "OTHER", label: "Outro" },
] as const;

function dateToInputDate(iso: string): string {
  return iso.slice(0, 10);
}

function dateToInputTime(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 5);
}

export function ActivityModal({
  isOpen,
  onClose,
  onSaved,
  activity,
  prefill,
  children,
  familyId,
}: ActivityModalProps) {
  const [form, setForm] = useState<FormState>({
    title: "",
    child_id: "",
    category: "OTHER",
    date: "",
    start_time: "",
    end_time: "",
    location: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setConfirmDelete(false);
    setError(null);
    if (activity) {
      setForm({
        title: activity.title,
        child_id: activity.child_id ?? "",
        category: activity.category,
        date: dateToInputDate(activity.start_at),
        start_time: dateToInputTime(activity.start_at),
        end_time: activity.end_at ? dateToInputTime(activity.end_at) : "",
        location: activity.location ?? "",
      });
    } else {
      setForm({
        title: prefill?.title ?? "",
        child_id: prefill?.child_id ?? "",
        category: prefill?.category ?? "OTHER",
        date: prefill?.date ?? "",
        start_time: prefill?.start_time ?? "",
        end_time: prefill?.end_time ?? "",
        location: prefill?.location ?? "",
      });
    }
  }, [isOpen, activity, prefill]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Titulo obrigatorio");
      return;
    }
    if (!form.date || !form.start_time) {
      setError("Data e horario de inicio obrigatorios");
      return;
    }

    setLoading(true);
    setError(null);

    const start_at = new Date(`${form.date}T${form.start_time}:00`).toISOString();
    const end_at = form.end_time
      ? new Date(`${form.date}T${form.end_time}:00`).toISOString()
      : undefined;

    const payload = {
      family_id: familyId,
      child_id: form.child_id || undefined,
      title: form.title.trim(),
      category: form.category,
      start_at,
      end_at,
      location: form.location.trim() || undefined,
    };

    try {
      const url = activity ? `/api/activities/${activity.id}` : "/api/activities";
      const method = activity ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar atividade");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!activity) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error ?? "Erro ao excluir atividade");
        setConfirmDelete(false);
      }
    } catch {
      setError("Erro de conexao. Tente novamente.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {activity ? "Editar atividade" : "Nova atividade"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Input
            label="Titulo"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex: Futebol do Pedro"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Filho"
              value={form.child_id}
              onChange={(e) => set("child_id", e.target.value)}
            >
              <option value="">Toda a familia</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Select
              label="Categoria"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Data"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              required
            />
            <Input
              label="Inicio"
              type="time"
              value={form.start_time}
              onChange={(e) => set("start_time", e.target.value)}
              required
            />
            <Input
              label="Termino"
              type="time"
              value={form.end_time}
              onChange={(e) => set("end_time", e.target.value)}
            />
          </div>

          <Input
            label="Local (opcional)"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Ex: Quadra do bairro"
          />

          <div className="flex items-center justify-between pt-2">
            <div>
              {activity && !confirmDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:bg-red-50"
                  onClick={() => setConfirmDelete(true)}
                >
                  Excluir
                </Button>
              )}
              {activity && confirmDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Confirmar?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    loading={deleting}
                    onClick={handleDelete}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Nao
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                {activity ? "Salvar" : "Criar atividade"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

type VaccineStatus = "done" | "overdue" | "upcoming" | "future";

interface VaccineRow {
  key: string;
  name: string;
  dose: string;
  dueDate: string;
  ageMonths: number;
  status: VaccineStatus;
  activityId: string | null;
}

interface ExtraVaccineRow {
  id: string;
  name: string;
  dose: string;
  takenAt: string;
}

interface SaudeClientProps {
  childName: string;
  childColor: string;
  birthDate: string;
  vaccineRows: VaccineRow[];
  familyId: string;
  childId: string;
  initialExtraVaccines: ExtraVaccineRow[];
}

const STATUS_CONFIG: Record<VaccineStatus, { label: string; dot: string; badge: string }> = {
  done: { label: "Tomada", dot: "bg-green-500", badge: "bg-green-100 text-green-800" },
  overdue: { label: "Atrasada", dot: "bg-red-500", badge: "bg-red-100 text-red-800" },
  upcoming: { label: "Proxima (30 dias)", dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800" },
  future: { label: "Futura", dot: "bg-gray-300", badge: "bg-gray-100 text-gray-600" },
};

function deriveStatus(dueDate: string): VaccineStatus {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const due = new Date(dueDate);
  if (due < now) return "overdue";
  if (due <= in30Days) return "upcoming";
  return "future";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAge(months: number): string {
  if (months === 0) return "Ao nascer";
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (m === 0) return `${y} ${y === 1 ? "ano" : "anos"}`;
  return `${y}a ${m}m`;
}

function Checkbox({ checked, loading, disabled, onChange }: {
  checked: boolean;
  loading: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled || loading}
      className={`h-5 w-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
        checked
          ? "bg-green-500 border-green-500"
          : "border-gray-300 bg-white hover:border-green-400"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {loading ? (
        <svg className="h-3 w-3 animate-spin text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : checked ? (
        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : null}
    </button>
  );
}

export function SaudeClient({
  childName,
  childColor,
  vaccineRows,
  familyId,
  childId,
  initialExtraVaccines,
}: SaudeClientProps) {
  const [rows, setRows] = useState<VaccineRow[]>(vaccineRows);
  const [marking, setMarking] = useState<string | null>(null);
  const [extraVaccines, setExtraVaccines] = useState<ExtraVaccineRow[]>(initialExtraVaccines);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", dose: "", date: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const done = rows.filter((r) => r.status === "done").length;
  const total = rows.length;
  const overdue = rows.filter((r) => r.status === "overdue").length;

  async function handleToggle(row: VaccineRow) {
    if (!row.activityId || marking) return;
    const isDone = row.status === "done";
    const apiStatus = isDone ? "ACTIVE" : "DONE";
    const newStatus: VaccineStatus = isDone ? deriveStatus(row.dueDate) : "done";
    setMarking(row.key);
    try {
      const res = await fetch(`/api/activities/${row.activityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: apiStatus }),
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) => (r.key === row.key ? { ...r, status: newStatus } : r))
        );
      }
    } finally {
      setMarking(null);
    }
  }

  async function handleAddExtra(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim() || !form.date) return;
    setSaving(true);
    try {
      const startAt = new Date(form.date + "T09:00:00");
      const dose = form.dose.trim() || "Dose unica";
      const title = `Vacina: ${form.name.trim()} - ${dose}`;
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_id: familyId,
          child_id: childId,
          title,
          category: "MEDICAL",
          start_at: startAt.toISOString(),
          status: "DONE",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error ?? "Erro ao salvar");
        return;
      }
      const data = await res.json();
      setExtraVaccines((prev) => [
        ...prev,
        {
          id: data.activity.id,
          name: form.name.trim(),
          dose,
          takenAt: startAt.toISOString(),
        },
      ]);
      setForm({ name: "", dose: "", date: "" });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: childColor }}
        >
          {childName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saude de {childName}</h1>
          <p className="text-sm text-gray-500">Calendario de Vacinacao PNI 2024</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-2xl font-bold text-green-600">{done}</p>
          <p className="text-xs text-gray-500">Vacinas em dia</p>
        </div>
        <div className="card p-5">
          <p className={`text-2xl font-bold ${overdue > 0 ? "text-red-600" : "text-gray-400"}`}>
            {overdue}
          </p>
          <p className="text-xs text-gray-500">Atrasadas</p>
        </div>
        <div className="card p-5">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500">Total previstas</p>
        </div>
      </div>

      {/* PNI Calendar */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Calendario de Vacinacao PNI</h2>
            <span className="text-sm text-gray-500">{done} de {total} em dia</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-green-500 transition-all"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Clique no checkbox para marcar ou desmarcar uma vacina como tomada
          </p>
        </div>

        <div className="divide-y divide-gray-50">
          {rows.map((row) => {
            const cfg = STATUS_CONFIG[row.status];
            const isLoading = marking === row.key;
            return (
              <div key={row.key} className="flex items-center gap-3 px-6 py-3">
                <Checkbox
                  checked={row.status === "done"}
                  loading={isLoading}
                  disabled={!row.activityId || (!!marking && !isLoading)}
                  onChange={() => handleToggle(row)}
                />
                <div className={`h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`truncate text-sm font-medium ${
                    row.status === "done" ? "text-gray-400 line-through" : "text-gray-900"
                  }`}>
                    {row.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {row.dose} &middot; {formatAge(row.ageMonths)} &middot; {formatDate(row.dueDate)}
                  </p>
                </div>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Extra vaccines */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Vacinas Extraordinarias</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Vacinas fora do calendario PNI ou tomadas antes do cadastro
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
          >
            + Adicionar
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAddExtra} className="border-b border-gray-100 bg-gray-50 px-6 py-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nome da vacina <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Influenza, Dengue, HPV..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Dose / Descricao
                </label>
                <input
                  type="text"
                  value={form.dose}
                  onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))}
                  placeholder="Ex: 1ª dose, Dose unica, Reforco..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Data tomada <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
            {formError && (
              <p className="text-xs text-red-600">{formError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm({ name: "", dose: "", date: "" });
                  setFormError("");
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Salvando..." : "Salvar vacina"}
              </button>
            </div>
          </form>
        )}

        {extraVaccines.length === 0 && !showForm ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            Nenhuma vacina extra registrada. Clique em &ldquo;+ Adicionar&rdquo; para registrar.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {extraVaccines.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-6 py-3">
                <div className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{v.name}</p>
                  <p className="text-xs text-gray-500">
                    {v.dose} &middot; {formatDate(v.takenAt)}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  Tomada
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400">
        Fonte: Calendario Nacional de Vacinacao 2024 - PNI/SVS/MS
      </p>
    </div>
  );
}

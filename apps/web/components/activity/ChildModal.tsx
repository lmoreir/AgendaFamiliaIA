"use client";

import { useState, useEffect } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { CHILD_COLORS } from "../../lib/utils";

interface ChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  familyId: string;
}

export function ChildModal({ isOpen, onClose, onSaved, familyId }: ChildModalProps) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [color, setColor] = useState(CHILD_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setBirthDate("");
    setColor(CHILD_COLORS[0]);
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nome obrigatorio");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_id: familyId,
          name: name.trim(),
          birth_date: birthDate || undefined,
          color,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao adicionar filho");
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
        className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Adicionar filho</h2>
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
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Pedro"
            required
          />

          <Input
            label="Data de nascimento (opcional)"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />

          <div className="space-y-1">
            <label className="label block">Cor no calendario</label>
            <div className="flex gap-2">
              {CHILD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "#111827" : "transparent",
                  }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              Adicionar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

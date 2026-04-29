"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "../../../components/ui/Button";
import { ChildModal } from "../../../components/activity/ChildModal";
import { getInitials } from "../../../lib/utils";
import { getNextVaccine, getOverdueCount } from "../../../lib/vaccination/pni-calendar";

interface ChildData {
  id: string;
  name: string;
  color: string;
  birth_date?: string | null;
}

interface FilhosClientProps {
  initialChildren: ChildData[];
  familyId: string;
}

function calcAge(birthDate: string): string {
  const born = new Date(birthDate);
  const now = new Date();
  const years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  const age = m < 0 || (m === 0 && now.getDate() < born.getDate()) ? years - 1 : years;
  if (age < 1) {
    const months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
    return `${months} ${months === 1 ? "mes" : "meses"}`;
  }
  return age === 1 ? "1 ano" : `${age} anos`;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function VaccineInfo({ birthDate }: { birthDate: string }) {
  const birth = new Date(birthDate);
  const next = getNextVaccine(birth);
  const overdue = getOverdueCount(birth);

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
      {overdue > 0 && (
        <p className="text-xs font-medium text-red-600">
          {overdue} vacina{overdue > 1 ? "s" : ""} atrasada{overdue > 1 ? "s" : ""}
        </p>
      )}
      {next && (
        <p className="text-xs text-gray-500">
          Proxima: <span className="font-medium text-gray-700">{next.name} - {next.dose}</span>{" "}
          <span className="text-gray-400">({formatShortDate(next.dueDate)})</span>
        </p>
      )}
    </div>
  );
}

export function FilhosClient({ initialChildren, familyId }: FilhosClientProps) {
  const [children, setChildren] = useState<ChildData[]>(initialChildren);
  const [modalOpen, setModalOpen] = useState(false);

  async function reload() {
    try {
      const res = await fetch(`/api/children?familyId=${familyId}`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.children ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          birth_date: c.birth_date ?? null,
        }));
        setChildren(mapped);
      }
    } catch {
      // silently ignore refresh errors
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Filhos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie o perfil de cada filho
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Adicionar filho</Button>
      </div>

      {children.length === 0 ? (
        <div className="card">
          <div className="card-body flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg
                className="h-8 w-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">
              Nenhum filho cadastrado
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Adicione os perfis dos seus filhos para organizar as atividades
            </p>
            <Button className="mt-4" onClick={() => setModalOpen(true)}>
              + Adicionar filho
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <div key={child.id} className="card p-5">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: child.color }}
                >
                  {getInitials(child.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">
                    {child.name}
                  </p>
                  {child.birth_date ? (
                    <p className="text-sm text-gray-500">
                      {calcAge(child.birth_date)}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">Idade nao informada</p>
                  )}
                </div>
              </div>

              {child.birth_date && <VaccineInfo birthDate={child.birth_date} />}

              <div className="mt-3 flex gap-2">
                {child.birth_date && (
                  <Link
                    href={`/filhos/${child.id}/saude`}
                    className="flex-1 rounded-lg border border-gray-200 py-1.5 text-center text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Ver vacinacao
                  </Link>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={() => setModalOpen(true)}
            className="card flex h-full min-h-24 items-center justify-center border-dashed p-5 text-sm text-gray-400 hover:border-brand-300 hover:text-brand-500 transition-colors"
          >
            + Adicionar filho
          </button>
        </div>
      )}

      <ChildModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          reload();
        }}
        familyId={familyId}
      />
    </div>
  );
}

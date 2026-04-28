import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina classes do Tailwind sem conflitos.
 * Usa clsx para condicionais e tailwind-merge para deduplicar.
 *
 * Exemplo: cn("px-4 py-2", isActive && "bg-brand-600", "text-sm")
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formata data para exibição em pt-BR
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formata horário para exibição
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Retorna as iniciais de um nome (máx 2 letras)
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/**
 * Cores predefinidas para filhos no calendário
 */
export const CHILD_COLORS = [
  "#3b82f6", // azul
  "#8b5cf6", // roxo
  "#f59e0b", // âmbar
  "#ef4444", // vermelho
  "#ec4899", // rosa
  "#14b8a6", // teal
];

export function getChildColor(index: number): string {
  return CHILD_COLORS[index % CHILD_COLORS.length];
}

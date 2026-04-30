"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/agenda",        icon: "📅", label: "Agenda" },
  { href: "/filhos",        icon: "👦", label: "Filhos" },
  { href: "/lembretes",     icon: "🔔", label: "Lembretes" },
  { href: "/configuracoes", icon: "⚙️",  label: "Configurações" },
];

export function Sidebar({
  displayName,
  initial,
}: {
  displayName: string;
  initial: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Hamburger — visível só no mobile */}
      <button
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm md:hidden"
      >
        <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop — mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-6">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
            <span className="text-sm">📅</span>
          </div>
          <span className="font-semibold text-gray-900">Agenda Família</span>
          <button
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="ml-auto text-gray-400 hover:text-gray-600 md:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                ].join(" ")}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
              <Link
                href="/configuracoes"
                onClick={() => setOpen(false)}
                className="truncate text-xs text-gray-400 hover:text-gray-600"
              >
                Configurações
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

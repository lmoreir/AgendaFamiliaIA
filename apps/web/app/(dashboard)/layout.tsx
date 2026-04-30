import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { prisma } from "../../lib/prisma";

export const metadata: Metadata = { title: "Dashboard" };

const navItems = [
  { href: "/agenda",         icon: "📅", label: "Agenda" },
  { href: "/filhos",         icon: "👦", label: "Filhos" },
  { href: "/lembretes",      icon: "🔔", label: "Lembretes" },
  { href: "/configuracoes",  icon: "⚙️",  label: "Configurações" },
];

async function getCurrentUser() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    return prisma.user.findUnique({
      where: { email: user.email },
      select: { name: true, email: true },
    });
  } catch {
    return null;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const displayName = user?.name || user?.email?.split("@")[0] || "Usuário";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <span className="text-sm">📅</span>
          </div>
          <span className="font-semibold text-gray-900">Agenda Família</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
              <Link href="/configuracoes" className="truncate text-xs text-gray-400 hover:text-gray-600">
                Configurações
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="ml-64 flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

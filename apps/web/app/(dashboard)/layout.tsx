import type { Metadata } from "next";
import { createClient } from "../../lib/supabase/server";
import { prisma } from "../../lib/prisma";
import { Sidebar } from "../../components/layout/Sidebar";

export const metadata: Metadata = { title: "Dashboard" };

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
      <Sidebar displayName={displayName} initial={initial} />
      <main className="min-w-0 flex-1 overflow-auto pt-16 md:ml-64 md:pt-0">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { prisma } from "../../../lib/prisma";
import { LembretesClient } from "./LembretesClient";

export const metadata: Metadata = { title: "Lembretes" };

export default async function LembretesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prismaUser = await prisma.user.upsert({
    where: { email: user.email! },
    create: {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name ?? user.email!.split("@")[0],
    },
    update: {},
  });

  let family = await prisma.family.findFirst({
    where: { owner_id: prismaUser.id },
  });

  if (!family) {
    family = await prisma.family.create({
      data: {
        owner_id: prismaUser.id,
        name: `Familia de ${prismaUser.name}`,
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
      },
    });
  }

  const reminders = await prisma.reminder.findMany({
    where: { family_id: family.id },
    include: {
      activity: {
        include: { child: true },
      },
    },
    orderBy: { trigger_at: "asc" },
  });

  const serialized = reminders.map((r) => ({
    id: r.id,
    trigger_at: r.trigger_at.toISOString(),
    channels: r.channels as string[],
    status: r.status as string,
    sent_at: r.sent_at?.toISOString() ?? null,
    activity: {
      id: r.activity.id,
      title: r.activity.title,
      start_at: r.activity.start_at.toISOString(),
      category: r.activity.category as string,
      child: r.activity.child
        ? {
            id: r.activity.child.id,
            name: r.activity.child.name,
            color: r.activity.child.color,
          }
        : null,
    },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lembretes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie quando e como voce recebe notificacoes
        </p>
      </div>
      <LembretesClient initialReminders={serialized} familyId={family.id} />
    </div>
  );
}

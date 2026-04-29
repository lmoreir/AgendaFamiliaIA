import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { prisma } from "../../../lib/prisma";
import { WeeklyCalendar } from "./WeeklyCalendar";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    include: { children: { orderBy: { name: "asc" } } },
  });

  if (!family) {
    family = await prisma.family.create({
      data: {
        owner_id: prismaUser.id,
        name: `Familia de ${prismaUser.name}`,
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
      },
      include: { children: { orderBy: { name: "asc" } } },
    });
  }

  const children = family.children.map((c) => ({
    id: c.id,
    family_id: c.family_id,
    name: c.name,
    color: c.color,
    birth_date: c.birth_date?.toISOString() ?? null,
    avatar_url: c.avatar_url ?? null,
  }));

  return (
    <WeeklyCalendar
      familyId={family.id}
      userId={prismaUser.id}
      children={children}
    />
  );
}

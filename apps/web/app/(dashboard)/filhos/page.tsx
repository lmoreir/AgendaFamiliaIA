import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { prisma } from "../../../lib/prisma";
import { getVaccineSchedule } from "../../../lib/vaccination/pni-calendar";
import { FilhosClient } from "./FilhosClient";

export const metadata: Metadata = { title: "Filhos" };

export default async function FilhosPage() {
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

  // Busca atividades de vacina de todos os filhos de uma vez
  const childrenWithBirth = family.children.filter((c) => c.birth_date);
  const vaccineActivities =
    childrenWithBirth.length > 0
      ? await prisma.activity.findMany({
          where: {
            child_id: { in: childrenWithBirth.map((c) => c.id) },
            category: "MEDICAL",
            title: { startsWith: "Vacina:" },
          },
          select: { child_id: true, title: true, status: true },
        })
      : [];

  // Agrupa por filho
  const actsByChild = new Map<string, { title: string; status: string }[]>();
  for (const act of vaccineActivities) {
    if (!act.child_id) continue;
    if (!actsByChild.has(act.child_id)) actsByChild.set(act.child_id, []);
    actsByChild.get(act.child_id)!.push({ title: act.title, status: act.status });
  }

  // Computa resumo real por filho
  const now = new Date();
  const summaries = new Map<string, { done: number; total: number; overdue: number }>();

  for (const child of childrenWithBirth) {
    const schedule = getVaccineSchedule(child.birth_date!);
    const acts = actsByChild.get(child.id) ?? [];

    const doneKeys = new Set<string>();
    for (const act of acts) {
      if (act.status !== "DONE") continue;
      const match = act.title.match(/^Vacina:\s+(.+?)\s+-\s+(.+?)(?:\s+\[ATRASADA\])?$/);
      if (match) doneKeys.add(`${match[1]}__${match[2]}`);
    }

    let done = 0;
    let overdue = 0;
    for (const event of schedule) {
      if (doneKeys.has(event.key)) {
        done++;
      } else if (event.dueDate < now) {
        overdue++;
      }
    }

    summaries.set(child.id, { done, total: schedule.length, overdue });
  }

  const children = family.children.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    birth_date: c.birth_date?.toISOString() ?? null,
    vaccineSummary: c.birth_date ? (summaries.get(c.id) ?? null) : null,
  }));

  return <FilhosClient initialChildren={children} familyId={family.id} />;
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";
import { prisma } from "../../../../../lib/prisma";
import { getVaccineSchedule } from "../../../../../lib/vaccination/pni-calendar";
import { SaudeClient } from "./SaudeClient";

export const metadata: Metadata = { title: "Saude" };

export default async function SaudePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prismaUser = await prisma.user.findFirst({ where: { email: user.email! } });
  if (!prismaUser) redirect("/login");

  const child = await prisma.child.findFirst({
    where: { id: params.id, family: { owner_id: prismaUser.id } },
    include: { family: true },
  });
  if (!child) notFound();

  if (!child.birth_date) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Saude de {child.name}</h1>
        <div className="card">
          <div className="card-body py-16 text-center">
            <p className="font-semibold text-gray-900">Data de nascimento nao informada</p>
            <p className="mt-1 text-sm text-gray-500">
              Edite o perfil de {child.name} e informe a data de nascimento para
              ver o calendario de vacinacao.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const schedule = getVaccineSchedule(child.birth_date);
  const pniKeys = new Set(schedule.map((e) => e.key));

  const vaccineActivities = await prisma.activity.findMany({
    where: {
      child_id: child.id,
      category: "MEDICAL",
      title: { startsWith: "Vacina:" },
    },
    orderBy: { start_at: "asc" },
  });

  const activityByKey = new Map<string, { id: string; status: string }>();
  for (const act of vaccineActivities) {
    const match = act.title.match(/^Vacina:\s+(.+?)\s+-\s+(.+?)(?:\s+\[ATRASADA\])?$/);
    if (match) {
      const key = `${match[1]}__${match[2]}`;
      activityByKey.set(key, { id: act.id, status: act.status });
    }
  }

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const vaccineRows = schedule.map((event) => {
    const act = activityByKey.get(event.key);
    let status: "done" | "overdue" | "upcoming" | "future";
    if (act?.status === "DONE") {
      status = "done";
    } else if (event.dueDate < now) {
      status = "overdue";
    } else if (event.dueDate <= in30Days) {
      status = "upcoming";
    } else {
      status = "future";
    }

    return {
      key: event.key,
      name: event.name,
      dose: event.dose,
      ageMonths: event.ageMonths,
      dueDate: event.dueDate.toISOString(),
      status,
      activityId: act?.id ?? null,
    };
  });

  // Extra vaccines: activities that don't match any PNI key
  const extraVaccines = vaccineActivities
    .filter((act) => {
      const match = act.title.match(/^Vacina:\s+(.+?)\s+-\s+(.+?)(?:\s+\[ATRASADA\])?$/);
      if (!match) return false;
      const key = `${match[1]}__${match[2]}`;
      return !pniKeys.has(key);
    })
    .map((act) => {
      const match = act.title.match(/^Vacina:\s+(.+?)\s+-\s+(.+?)(?:\s+\[ATRASADA\])?$/);
      return {
        id: act.id,
        name: match![1],
        dose: match![2],
        takenAt: act.start_at.toISOString(),
      };
    });

  return (
    <SaudeClient
      childName={child.name}
      childColor={child.color}
      birthDate={child.birth_date.toISOString()}
      vaccineRows={vaccineRows}
      familyId={child.family_id}
      childId={child.id}
      initialExtraVaccines={extraVaccines}
    />
  );
}

import { getVaccineSchedule, vaccineTitle } from "./pni-calendar";

type AnyPrisma = any;

const VACCINATION_TAG = "Calendario PNI - Ministerio da Saude";

export async function hasVaccinationSchedule(
  childId: string,
  prismaClient: AnyPrisma
): Promise<boolean> {
  const count = await prismaClient.activity.count({
    where: {
      child_id: childId,
      category: "MEDICAL",
      description: VACCINATION_TAG,
    },
  });
  return count > 0;
}

export async function createVaccinationActivities(opts: {
  familyId: string;
  childId: string;
  createdBy: string;
  birthDate: Date;
  prismaClient: AnyPrisma;
}): Promise<void> {
  const { familyId, childId, createdBy, birthDate, prismaClient } = opts;

  if (await hasVaccinationSchedule(childId, prismaClient)) return;

  const schedule = getVaccineSchedule(birthDate);

  for (const event of schedule) {
    const due = new Date(event.dueDate);
    due.setHours(9, 0, 0, 0);
    const end = new Date(due.getTime() + 30 * 60 * 1000);

    const activity = await prismaClient.activity.create({
      data: {
        family_id: familyId,
        child_id: childId,
        created_by: createdBy,
        title: vaccineTitle(event.name, event.dose, event.isOverdue),
        description: VACCINATION_TAG,
        category: "MEDICAL",
        location: "Unidade Basica de Saude (UBS)",
        start_at: due,
        end_at: end,
        status: "ACTIVE",
        source: "AI",
      },
    });

    // Lembrete 3 dias antes para vacinas futuras
    const threeDaysBefore = new Date(due.getTime() - 3 * 24 * 60 * 60 * 1000);
    if (threeDaysBefore > new Date()) {
      await prismaClient.reminder.create({
        data: {
          activity_id: activity.id,
          family_id: familyId,
          trigger_at: threeDaysBefore,
          channels: ["WHATSAPP"],
          status: "PENDING",
        },
      });
    }
  }
}

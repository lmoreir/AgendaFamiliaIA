export interface VaccineDose {
  dose: string;
  ageMonths: number;
}

export interface Vaccine {
  name: string;
  doses: VaccineDose[];
}

export interface VaccineEvent {
  key: string;
  name: string;
  dose: string;
  ageMonths: number;
  dueDate: Date;
  isOverdue: boolean;
  isUpcoming: boolean;
}

export const PNI_VACCINES: Vaccine[] = [
  { name: "BCG", doses: [{ dose: "dose unica", ageMonths: 0 }] },
  {
    name: "Hepatite B",
    doses: [
      { dose: "1a dose", ageMonths: 0 },
      { dose: "2a dose", ageMonths: 2 },
      { dose: "3a dose", ageMonths: 6 },
    ],
  },
  {
    name: "Pentavalente (DTP+Hib+HepB)",
    doses: [
      { dose: "1a dose", ageMonths: 2 },
      { dose: "2a dose", ageMonths: 4 },
      { dose: "3a dose", ageMonths: 6 },
    ],
  },
  {
    name: "VIP (Poliomielite inativada)",
    doses: [
      { dose: "1a dose", ageMonths: 2 },
      { dose: "2a dose", ageMonths: 4 },
    ],
  },
  {
    name: "VOP (Poliomielite oral)",
    doses: [
      { dose: "1a dose", ageMonths: 6 },
      { dose: "reforco", ageMonths: 15 },
    ],
  },
  {
    name: "Pneumococica 10-valente",
    doses: [
      { dose: "1a dose", ageMonths: 2 },
      { dose: "2a dose", ageMonths: 4 },
      { dose: "reforco", ageMonths: 12 },
    ],
  },
  {
    name: "Rotavirus Humano",
    doses: [
      { dose: "1a dose", ageMonths: 2 },
      { dose: "2a dose", ageMonths: 4 },
    ],
  },
  {
    name: "Meningococica C",
    doses: [
      { dose: "1a dose", ageMonths: 3 },
      { dose: "2a dose", ageMonths: 5 },
      { dose: "reforco", ageMonths: 12 },
    ],
  },
  {
    name: "Febre Amarela",
    doses: [
      { dose: "dose inicial", ageMonths: 9 },
      { dose: "reforco", ageMonths: 48 },
    ],
  },
  {
    name: "Triplice Viral (SCR)",
    doses: [
      { dose: "1a dose", ageMonths: 12 },
      { dose: "2a dose", ageMonths: 15 },
    ],
  },
  {
    name: "DTP (Triplice bacteriana)",
    doses: [
      { dose: "1o reforco", ageMonths: 15 },
      { dose: "2o reforco", ageMonths: 48 },
    ],
  },
  {
    name: "Hepatite A",
    doses: [{ dose: "dose unica", ageMonths: 15 }],
  },
  {
    name: "Varicela",
    doses: [{ dose: "dose unica", ageMonths: 15 }],
  },
  {
    name: "HPV Quadrivalente",
    doses: [
      { dose: "1a dose", ageMonths: 108 },
      { dose: "2a dose", ageMonths: 114 },
    ],
  },
  {
    name: "Meningococica ACWY",
    doses: [{ dose: "dose unica", ageMonths: 132 }],
  },
];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function getVaccineSchedule(birthDate: Date): VaccineEvent[] {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const events: VaccineEvent[] = [];

  for (const vaccine of PNI_VACCINES) {
    for (const doseDef of vaccine.doses) {
      const dueDate = addMonths(birthDate, doseDef.ageMonths);
      const isOverdue = dueDate < now;
      const isUpcoming = !isOverdue && dueDate <= in30Days;
      events.push({
        key: `${vaccine.name}__${doseDef.dose}`,
        name: vaccine.name,
        dose: doseDef.dose,
        ageMonths: doseDef.ageMonths,
        dueDate,
        isOverdue,
        isUpcoming,
      });
    }
  }

  events.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return events;
}

export function getNextVaccine(birthDate: Date): VaccineEvent | null {
  const now = new Date();
  const schedule = getVaccineSchedule(birthDate);
  return schedule.find((e) => e.dueDate >= now) ?? null;
}

export function getOverdueCount(birthDate: Date): number {
  return getVaccineSchedule(birthDate).filter((e) => e.isOverdue).length;
}

export function vaccineTitle(name: string, dose: string, overdue: boolean): string {
  const tag = overdue ? " [ATRASADA]" : "";
  return `Vacina: ${name} - ${dose}${tag}`;
}

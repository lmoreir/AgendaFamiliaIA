import { NextRequest, NextResponse } from "next/server";
import { createVaccinationActivities } from "@/lib/vaccination/VaccinationService";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const ListSchema = z.object({
  familyId: z.string().uuid("familyId invalido"),
});

const CreateSchema = z.object({
  family_id: z.string().uuid(),
  name: z.string().min(1, "Nome obrigatorio").max(100),
  birth_date: z.string().date().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor invalida")
    .optional()
    .default("#3b82f6"),
});

async function resolveUser(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  return prisma.user.upsert({
    where: { email: user.email! },
    create: {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name ?? user.email!.split("@")[0],
    },
    update: {},
  });
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = ListSchema.safeParse({ familyId: searchParams.get("familyId") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const family = await prisma.family.findFirst({
    where: { id: parsed.data.familyId, owner_id: prismaUser.id },
  });
  if (!family) {
    return NextResponse.json({ error: "Familia nao encontrada" }, { status: 404 });
  }

  const children = await prisma.child.findMany({
    where: { family_id: parsed.data.familyId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ children }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const family = await prisma.family.findFirst({
    where: { id: parsed.data.family_id, owner_id: prismaUser.id },
  });
  if (!family) {
    return NextResponse.json({ error: "Familia nao encontrada" }, { status: 404 });
  }

  const birthDate = parsed.data.birth_date
    ? new Date(parsed.data.birth_date)
    : null;

  const child = await prisma.child.create({
    data: {
      family_id: parsed.data.family_id,
      name: parsed.data.name,
      birth_date: birthDate,
      color: parsed.data.color,
    },
  });

  if (birthDate) {
    createVaccinationActivities({
      familyId: parsed.data.family_id,
      childId: child.id,
      createdBy: prismaUser.id,
      birthDate,
      prismaClient: prisma,
    }).catch((err) =>
      console.error("[children POST] vaccination schedule error:", err)
    );
  }

  return NextResponse.json({ child }, { status: 201 });
}

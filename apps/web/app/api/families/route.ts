import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../lib/supabase/server";
import { prisma } from "../../../lib/prisma";

const CreateSchema = z.object({
  name: z.string().min(1, "Nome da família obrigatório").max(100),
  timezone: z.string().default("America/Sao_Paulo"),
});

async function resolveUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
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

export async function GET() {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const family = await prisma.family.findFirst({
    where: { owner_id: prismaUser.id },
    include: { children: { orderBy: { name: "asc" } } },
  });

  return NextResponse.json({ family: family ?? null }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const existing = await prisma.family.findFirst({ where: { owner_id: prismaUser.id } });
  if (existing) {
    return NextResponse.json({ error: "Usuário já possui uma família cadastrada" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const family = await prisma.family.create({
    data: {
      owner_id: prismaUser.id,
      name: parsed.data.name,
      timezone: parsed.data.timezone,
    },
    include: { children: true },
  });

  return NextResponse.json({ family }, { status: 201 });
}

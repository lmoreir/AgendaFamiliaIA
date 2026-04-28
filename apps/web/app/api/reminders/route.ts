import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const familyId = searchParams.get("familyId");
  if (!familyId) return NextResponse.json({ error: "familyId obrigatorio" }, { status: 400 });

  const family = await prisma.family.findFirst({
    where: { id: familyId, owner_id: prismaUser.id },
  });
  if (!family) return NextResponse.json({ error: "Familia nao encontrada" }, { status: 404 });

  const reminders = await prisma.reminder.findMany({
    where: { family_id: familyId },
    include: {
      activity: {
        include: { child: true },
      },
    },
    orderBy: { trigger_at: "asc" },
  });

  return NextResponse.json({ reminders });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

  const reminder = await prisma.reminder.findUnique({
    where: { id },
    include: { family: true },
  });
  if (!reminder || reminder.family.owner_id !== prismaUser.id) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  await prisma.reminder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

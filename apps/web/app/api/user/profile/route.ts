import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/supabase/server";
import { prisma } from "../../../../lib/prisma";

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

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone_whatsapp: z
    .string()
    .regex(/^\d{10,15}$/, "Número deve ter entre 10 e 15 dígitos (só números, com código do país)")
    .optional()
    .nullable(),
});

export async function GET() {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const family = await prisma.family.findFirst({
    where: { owner_id: prismaUser.id },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    user: {
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name,
      phone_whatsapp: prismaUser.phone_whatsapp,
      whatsapp_verified: prismaUser.whatsapp_verified,
    },
    family,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.phone_whatsapp !== undefined) {
    patch.phone_whatsapp = parsed.data.phone_whatsapp;
    patch.whatsapp_verified = false;
  }

  const updated = await prisma.user.update({
    where: { id: prismaUser.id },
    data: patch,
    select: { id: true, email: true, name: true, phone_whatsapp: true, whatsapp_verified: true },
  });

  return NextResponse.json({ user: updated });
}

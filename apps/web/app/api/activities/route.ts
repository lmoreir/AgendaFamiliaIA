import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../lib/supabase/server";
import { prisma } from "../../../lib/prisma";
import { ActivityService } from "../../../lib/services";

const service = new ActivityService(prisma as any);

const ListSchema = z.object({
  familyId: z.string().uuid("familyId invalido"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  childId: z.string().uuid().optional(),
});

const CreateSchema = z.object({
  family_id: z.string().uuid(),
  child_id: z.string().uuid().optional(),
  title: z.string().min(1, "Titulo obrigatorio").max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(["SCHOOL", "SPORT", "MEDICAL", "OTHER"]).default("OTHER"),
  start_at: z.string().datetime(),
  end_at: z.string().datetime().optional(),
  location: z.string().max(200).optional(),
  status: z.enum(["ACTIVE", "CANCELLED", "DONE"]).optional(),
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
  const parsed = ListSchema.safeParse({
    familyId: searchParams.get("familyId"),
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    childId: searchParams.get("childId") ?? undefined,
  });

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

  const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
  const to = parsed.data.to ? new Date(parsed.data.to) : undefined;

  const activities = await service.list({
    family_id: parsed.data.familyId,
    from,
    to,
    child_id: parsed.data.childId,
  });

  return NextResponse.json({ activities }, { status: 200 });
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

  const activity = await service.create({
    family_id: parsed.data.family_id,
    child_id: parsed.data.child_id,
    created_by: prismaUser.id,
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category,
    start_at: new Date(parsed.data.start_at),
    end_at: parsed.data.end_at ? new Date(parsed.data.end_at) : undefined,
    location: parsed.data.location,
    source: "WEB",
    status: parsed.data.status,
  });

  return NextResponse.json({ activity }, { status: 201 });
}

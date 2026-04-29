import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../lib/supabase/server";
import { prisma } from "../../../../lib/prisma";
import { ActivityService } from "../../../../lib/services";

const service = new ActivityService(prisma as any);

const UpdateSchema = z.object({
  child_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.enum(["SCHOOL", "SPORT", "MEDICAL", "OTHER"]).optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  status: z.enum(["ACTIVE", "CANCELLED", "DONE"]).optional(),
});

async function verifyOwnership(activityId: string, userEmail: string) {
  const prismaUser = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!prismaUser) return null;

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { family: { select: { owner_id: true } } },
  });
  if (!activity) return null;
  if (activity.family.owner_id !== prismaUser.id) return null;

  return { activity, prismaUser };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const result = await verifyOwnership(params.id, user.email!);
  if (!result) {
    return NextResponse.json({ error: "Atividade nao encontrada" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const patch: Parameters<typeof service.update>[1] = {};

  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description ?? undefined;
  if (data.category !== undefined) patch.category = data.category;
  if (data.start_at !== undefined) patch.start_at = new Date(data.start_at);
  if (data.end_at !== undefined) patch.end_at = data.end_at ? new Date(data.end_at) : undefined;
  if (data.location !== undefined) patch.location = data.location ?? undefined;
  if ("child_id" in data) patch.child_id = data.child_id ?? undefined;
  if (data.status !== undefined) patch.status = data.status;

  const activity = await service.update(params.id, patch);
  return NextResponse.json({ activity }, { status: 200 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const result = await verifyOwnership(params.id, user.email!);
  if (!result) {
    return NextResponse.json({ error: "Atividade nao encontrada" }, { status: 404 });
  }

  await service.delete(params.id);
  return NextResponse.json({ success: true }, { status: 200 });
}

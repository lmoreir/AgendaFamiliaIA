import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { prisma } from "../../../../../lib/prisma";
import { runICalImport } from "../../../../../lib/services/ICalImportService";

async function resolveUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return prisma.user.upsert({
    where: { email: user.email! },
    create: { id: user.id, email: user.email!, name: user.user_metadata?.full_name ?? user.email!.split("@")[0] },
    update: {},
  });
}

/** POST — salva URL e dispara importação */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const family = await prisma.family.findFirst({ where: { owner_id: prismaUser.id } });
  if (!family) return NextResponse.json({ error: "Família não encontrada" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const importUrl = (body.url as string | undefined)?.trim();
  const settings = (family.settings as Record<string, unknown>) ?? {};

  if (!importUrl) {
    const { ical_import_url: _u, ical_import_map: _m, ...rest } = settings;
    await prisma.family.update({ where: { id: family.id }, data: { settings: rest as any } });
    return NextResponse.json({ success: true, removed: true });
  }

  try { new URL(importUrl); } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const existingMap = (settings.ical_import_map as Record<string, string>) ?? {};
  const result = await runICalImport(family.id, prismaUser.id, importUrl, existingMap);

  await prisma.family.update({
    where: { id: family.id },
    data: { settings: { ...settings, ical_import_url: importUrl, ical_import_map: result.newMap } as any },
  });

  return NextResponse.json({ success: true, imported: result.imported, updated: result.updated, removed: result.removed });
}

/** DELETE — remove a integração */
export async function DELETE() {
  const supabase = createClient();
  const prismaUser = await resolveUser(supabase);
  if (!prismaUser) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const family = await prisma.family.findFirst({ where: { owner_id: prismaUser.id } });
  if (!family) return NextResponse.json({ error: "Família não encontrada" }, { status: 404 });

  const { ical_import_url: _u, ical_import_map: _m, ...rest } = (family.settings as Record<string, unknown>) ?? {};
  await prisma.family.update({ where: { id: family.id }, data: { settings: rest as any } });
  return NextResponse.json({ success: true });
}

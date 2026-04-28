import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/families — retorna a família do usuário autenticado
 * POST /api/families — cria uma nova família
 */

export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // TODO: buscar família do usuário via Prisma
  return NextResponse.json({ family: null }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();

  // TODO (Dia 2): validar com Zod + criar família via Prisma
  console.log("[Families] Criar família para:", user.id, body);

  return NextResponse.json({ message: "Em implementação" }, { status: 501 });
}

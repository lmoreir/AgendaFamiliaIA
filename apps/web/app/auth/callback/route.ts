import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /auth/callback
 * Supabase redireciona aqui após OAuth (Google) ou confirmação de e-mail.
 * Troca o code por uma sessão e redireciona para o dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const next  = searchParams.get("next") ?? "/agenda";
  const error = searchParams.get("error");

  // Supabase envia error_description em fluxos com problema
  if (error) {
    const desc = searchParams.get("error_description") ?? error;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(desc)}`);
  }

  if (code) {
    const supabase = createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Falha+na+autenticação`);
}

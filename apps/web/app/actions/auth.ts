"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const LoginSchema = z.object({
  email:    z.string().email("E-mail invalido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

const SignupSchema = z.object({
  name:     z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email:    z.string().email("E-mail invalido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  phone:    z.string().optional(),
});

export type AuthResult =
  | { success: true }
  | { success: false; error: string };

export async function loginAction(
  _prev: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const raw = {
    email:    formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { success: false, error: "E-mail ou senha incorretos" };
    }
    if (error.message.includes("Email not confirmed")) {
      return { success: false, error: "Confirme seu e-mail antes de entrar" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/agenda");
}

export async function signupAction(
  _prev: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const raw = {
    name:     formData.get("name"),
    email:    formData.get("email"),
    password: formData.get("password"),
    phone:    formData.get("phone") || undefined,
  };

  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email:    parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.name,
        phone:     parsed.data.phone ?? null,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { success: false, error: "Este e-mail ja esta cadastrado" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/agenda");
}

export async function logoutAction(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function oauthGoogleAction(): Promise<AuthResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) return { success: false, error: error.message };
  if (data.url) redirect(data.url);
  return { success: false, error: "Erro ao iniciar OAuth" };
}

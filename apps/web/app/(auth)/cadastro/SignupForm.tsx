"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signupAction } from "@/app/actions/auth";

type SignupState =
  | null
  | { success: false; error: string }
  | { success: true; confirmEmail?: boolean };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full py-2.5 disabled:opacity-60"
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Criando conta...
        </span>
      ) : (
        "Criar conta"
      )}
    </button>
  );
}

export function SignupForm() {
  const [state, action] = useFormState<SignupState, FormData>(
    signupAction as (prev: SignupState, data: FormData) => Promise<SignupState>,
    null
  );

  if (state && state.success && (state as { success: true; confirmEmail?: boolean }).confirmEmail) {
    return (
      <div className="card p-8 text-center">
        <div className="mb-4 text-5xl">:email:</div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Confirme seu e-mail</h2>
        <p className="text-sm text-gray-500">
          Enviamos um link de confirmacao para o seu e-mail. Clique no link para ativar sua conta.
        </p>
        <Link href="/login" className="btn-primary mt-6 inline-block">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <form action={action} className="space-y-4">
        {state && !state.success && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {(state as { success: false; error: string }).error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="label mb-1 block">Nome completo</label>
          <input id="name" name="name" type="text" placeholder="Ana Silva"
            className="input" autoComplete="name" required minLength={2} />
        </div>

        <div>
          <label htmlFor="email" className="label mb-1 block">E-mail</label>
          <input id="email" name="email" type="email" placeholder="seu@email.com"
            className="input" autoComplete="email" required />
        </div>

        <div>
          <label htmlFor="phone" className="label mb-1 block">
            WhatsApp <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input id="phone" name="phone" type="tel" placeholder="+55 11 99999-9999"
            className="input" autoComplete="tel" />
        </div>

        <div>
          <label htmlFor="password" className="label mb-1 block">Senha</label>
          <input id="password" name="password" type="password" placeholder="Minimo 8 caracteres"
            className="input" autoComplete="new-password" required minLength={8} />
        </div>

        <SubmitButton />

        <p className="text-center text-xs text-gray-400">
          Ao criar sua conta, voce concorda com os{" "}
          <Link href="/termos" className="underline">Termos de Uso</Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="underline">Politica de Privacidade</Link>
        </p>
      </form>
    </div>
  );
}

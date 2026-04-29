"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, oauthGoogleAction } from "../../actions/auth";
import type { AuthResult } from "../../actions/auth";

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
          Entrando...
        </span>
      ) : (
        "Entrar"
      )}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useFormState<AuthResult | null, FormData>(
    loginAction as (prev: AuthResult | null, data: FormData) => Promise<AuthResult | null>,
    null
  );

  return (
    <div className="card p-8">
      <form action={action} className="space-y-4">
        {state && !state.success && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="label mb-1 block">E-mail</label>
          <input id="email" name="email" type="email" placeholder="seu@email.com"
            className="input" autoComplete="email" required />
        </div>

        <div>
          <label htmlFor="password" className="label mb-1 block">Senha</label>
          <input id="password" name="password" type="password" placeholder="sua senha"
            className="input" autoComplete="current-password" required />
        </div>

        <SubmitButton />
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">ou continue com</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form action={async () => { await oauthGoogleAction(); }}>
        <button type="submit" className="btn-secondary w-full gap-3 py-2.5">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continuar com Google
        </button>
      </form>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <span className="text-sm font-bold text-white">A</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Entrar na sua conta</h1>
          <p className="mt-1 text-sm text-gray-500">
            Nao tem conta?{" "}
            <Link href="/cadastro" className="font-medium text-brand-600 hover:text-brand-700">
              Cadastre-se gratis
            </Link>
          </p>
        </div>

        {searchParams.error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {decodeURIComponent(searchParams.error)}
          </div>
        )}

        <LoginForm />
      </div>
    </div>
  );
}

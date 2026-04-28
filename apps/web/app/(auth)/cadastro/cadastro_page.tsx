import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Criar conta" };

export default function CadastroPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <span className="text-sm font-bold text-white">A</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Criar conta gratis</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ja tem conta?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Entrar
            </Link>
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4">
      <div className="max-w-2xl text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 shadow-lg">
            <span className="text-3xl font-bold text-white">A</span>
          </div>
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Agenda da{" "}
          <span className="text-brand-600">Familia IA</span>
        </h1>
        <p className="mb-8 text-lg text-gray-600">
          Organize as atividades dos seus filhos pelo{" "}
          <strong>WhatsApp</strong>. Lembretes automaticos,
          calendario familiar e assistente de IA.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/cadastro" className="btn-primary px-8 py-3 text-base">
            Comecar gratuitamente
          </Link>
          <Link href="/login" className="btn-secondary px-8 py-3 text-base">
            Ja tenho conta
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: "WA", title: "Via WhatsApp", desc: "Cadastre atividades em linguagem natural" },
            { icon: "AL", title: "Lembretes automaticos", desc: "Nunca mais esqueca consulta ou treino" },
            { icon: "DB", title: "Painel da familia", desc: "Veja a semana de todos os filhos" },
          ].map((f) => (
            <div key={f.title} className="card p-6 text-left">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">{f.icon}</div>
              <h3 className="mb-1 font-semibold text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Configurações" };

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500">Gerencie sua conta e integrações</p>
      </div>

      {/* WhatsApp */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Integração WhatsApp</h2>
        </div>
        <div className="card-body space-y-4">
          <p className="text-sm text-gray-600">
            Vincule seu número de WhatsApp para receber lembretes e cadastrar atividades por mensagem.
          </p>
          <div className="flex items-center gap-3">
            <input type="tel" placeholder="+55 11 99999-9999" className="input max-w-xs" />
            <button className="btn-primary">Verificar número</button>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
            <span>⚠️</span>
            <span>Número não vinculado. Vincule para receber lembretes via WhatsApp.</span>
          </div>
        </div>
      </div>

      {/* Conta */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Dados da conta</h2>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="label mb-1 block">Nome</label>
            <input type="text" defaultValue="Ana Silva" className="input max-w-sm" />
          </div>
          <div>
            <label className="label mb-1 block">E-mail</label>
            <input type="email" defaultValue="ana@email.com" className="input max-w-sm" />
          </div>
          <button className="btn-primary">Salvar alterações</button>
        </div>
      </div>
    </div>
  );
}

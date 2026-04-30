"use client";

import { useEffect, useState } from "react";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone_whatsapp: string | null;
  whatsapp_verified: boolean;
}

interface Family {
  id: string;
  name: string;
}

export default function ConfiguracoesPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [msgName, setMsgName] = useState("");
  const [msgPhone, setMsgPhone] = useState("");

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setProfile(data.user);
          setName(data.user.name ?? "");
          setPhone(data.user.phone_whatsapp ?? "");
        }
        if (data.family) setFamily(data.family);
      });
  }, []);

  async function saveName() {
    setSaving(true);
    setMsgName("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setProfile(data.user);
      setMsgName("✅ Nome salvo com sucesso!");
    } else {
      setMsgName("❌ Erro ao salvar. Tente novamente.");
    }
  }

  async function savePhone() {
    setSavingPhone(true);
    setMsgPhone("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      setMsgPhone("❌ Número inválido. Use apenas dígitos com código do país. Ex: 5548998202532");
      setSavingPhone(false);
      return;
    }
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_whatsapp: digits }),
    });
    const data = await res.json();
    setSavingPhone(false);
    if (res.ok) {
      setProfile(data.user);
      setPhone(data.user.phone_whatsapp ?? "");
      setMsgPhone("✅ Número salvo! Você já pode receber lembretes via WhatsApp.");
    } else {
      const fieldErr = data.error?.phone_whatsapp?.[0];
      setMsgPhone(`❌ ${fieldErr ?? "Erro ao salvar o número."}`);
    }
  }

  async function removePhone() {
    setMsgPhone("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_whatsapp: null }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile(data.user);
      setPhone("");
      setMsgPhone("Número removido.");
    }
  }

  const isPhoneLinked = !!profile?.phone_whatsapp;

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

          {isPhoneLinked ? (
            <div className="flex items-center gap-3 rounded-lg bg-green-50 p-3">
              <span className="text-green-600">✅</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Número vinculado</p>
                <p className="text-sm text-green-700">+{profile?.phone_whatsapp}</p>
              </div>
              <button
                onClick={removePhone}
                className="text-xs text-red-500 underline hover:text-red-700"
              >
                Remover
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
              <span>⚠️</span>
              <span>Número não vinculado. Vincule para receber lembretes via WhatsApp.</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="tel"
              placeholder="5548998202532 (com código do país)"
              className="input max-w-xs"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button className="btn-primary" onClick={savePhone} disabled={savingPhone}>
              {savingPhone ? "Salvando..." : isPhoneLinked ? "Atualizar número" : "Vincular número"}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Só números, com código do país. Exemplo: <strong>5548998202532</strong>
          </p>
          {msgPhone && <p className="text-sm font-medium text-gray-700">{msgPhone}</p>}
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
            <input
              type="text"
              className="input max-w-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label mb-1 block">E-mail</label>
            <input
              type="email"
              className="input max-w-sm bg-gray-50"
              value={profile?.email ?? ""}
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-gray-400">O e-mail não pode ser alterado.</p>
          </div>
          {family && (
            <div>
              <label className="label mb-1 block">Família</label>
              <input
                type="text"
                className="input max-w-sm bg-gray-50"
                value={family.name}
                disabled
                readOnly
              />
            </div>
          )}
          <button className="btn-primary" onClick={saveName} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
          {msgName && <p className="text-sm font-medium text-gray-700">{msgName}</p>}
        </div>
      </div>
    </div>
  );
}

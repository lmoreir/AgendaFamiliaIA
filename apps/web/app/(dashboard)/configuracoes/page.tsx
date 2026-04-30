"use client";

import { useEffect, useState } from "react";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone_whatsapp: string | null;
  whatsapp_verified: boolean;
}

interface FamilySettings {
  secondary_whatsapp?: string | null;
  notify_email?: boolean;
}

interface Family {
  id: string;
  name: string;
  settings?: FamilySettings | null;
}

export default function ConfiguracoesPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);

  // Dados da conta
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msgName, setMsgName] = useState("");

  // WhatsApp principal
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [msgPhone, setMsgPhone] = useState("");

  // Notificações da família
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [msgNotif, setMsgNotif] = useState("");

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setProfile(data.user);
          setName(data.user.name ?? "");
          setPhone(data.user.phone_whatsapp ?? "");
        }
        if (data.family) {
          setFamily(data.family);
          const s: FamilySettings = data.family.settings ?? {};
          setSecondaryPhone(s.secondary_whatsapp ?? "");
          setNotifyEmail(s.notify_email ?? false);
        }
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
    setMsgName(res.ok ? "✅ Nome salvo com sucesso!" : "❌ Erro ao salvar. Tente novamente.");
    if (res.ok) setProfile(data.user);
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
      setMsgPhone(`❌ ${data.error?.phone_whatsapp?.[0] ?? "Erro ao salvar o número."}`);
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
    if (res.ok) { setProfile(data.user); setPhone(""); setMsgPhone("Número removido."); }
  }

  async function saveNotifications() {
    if (!family) return;
    setSavingNotif(true);
    setMsgNotif("");

    const secDigits = secondaryPhone.replace(/\D/g, "");
    if (secondaryPhone && (secDigits.length < 10 || secDigits.length > 15)) {
      setMsgNotif("❌ Segundo número inválido. Use apenas dígitos com código do país. Ex: 5511999990000");
      setSavingNotif(false);
      return;
    }

    const res = await fetch("/api/families", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secondary_whatsapp: secDigits || null,
        notify_email: notifyEmail,
      }),
    });
    const data = await res.json();
    setSavingNotif(false);
    if (res.ok) {
      setFamily(data.family);
      const s: FamilySettings = data.family.settings ?? {};
      setSecondaryPhone(s.secondary_whatsapp ?? "");
      setNotifyEmail(s.notify_email ?? false);
      setMsgNotif("✅ Preferências de notificação salvas!");
    } else {
      setMsgNotif("❌ Erro ao salvar. Tente novamente.");
    }
  }

  const isPhoneLinked = !!profile?.phone_whatsapp;
  const hasSecondary = !!(family?.settings as FamilySettings | null)?.secondary_whatsapp;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500">Gerencie sua conta e integrações</p>
      </div>

      {/* WhatsApp principal */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">WhatsApp principal</h2>
        </div>
        <div className="card-body space-y-4">
          <p className="text-sm text-gray-600">
            Número vinculado à sua conta — usado para cadastrar atividades por mensagem e receber lembretes.
          </p>

          {isPhoneLinked ? (
            <div className="flex items-center gap-3 rounded-lg bg-green-50 p-3">
              <span className="text-green-600">✅</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Número vinculado</p>
                <p className="text-sm text-green-700">+{profile?.phone_whatsapp}</p>
              </div>
              <button onClick={removePhone} className="text-xs text-red-500 underline hover:text-red-700">
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
              {savingPhone ? "Salvando..." : isPhoneLinked ? "Atualizar" : "Vincular"}
            </button>
          </div>
          <p className="text-xs text-gray-400">Só dígitos, com código do país. Ex: <strong>5548998202532</strong></p>
          {msgPhone && <p className="text-sm font-medium text-gray-700">{msgPhone}</p>}
        </div>
      </div>

      {/* Notificações */}
      {family && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Notificações de lembretes</h2>
          </div>
          <div className="card-body space-y-5">
            <p className="text-sm text-gray-600">
              Configure canais adicionais para garantir que os lembretes das atividades não sejam perdidos.
            </p>

            {/* Segundo número WhatsApp */}
            <div className="space-y-2">
              <label className="label block font-medium">Segundo número WhatsApp <span className="text-gray-400 font-normal">(opcional)</span></label>
              <p className="text-xs text-gray-500">
                Um segundo contato que também receberá os lembretes — ideal para parceiro(a), avós ou responsáveis.
              </p>
              {hasSecondary && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <span>✅</span>
                  <span>+{(family.settings as FamilySettings).secondary_whatsapp} — receberá lembretes</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="tel"
                  placeholder="5511999990000 (opcional)"
                  className="input max-w-xs"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400">Deixe em branco para remover o segundo número.</p>
            </div>

            {/* Notificação por email */}
            <div className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <input
                id="notify-email"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
              />
              <div>
                <label htmlFor="notify-email" className="text-sm font-medium text-gray-900 cursor-pointer">
                  Receber lembretes por e-mail também
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Os lembretes serão enviados para <strong>{profile?.email}</strong> além do WhatsApp.
                </p>
              </div>
            </div>

            <button className="btn-primary" onClick={saveNotifications} disabled={savingNotif}>
              {savingNotif ? "Salvando..." : "Salvar preferências"}
            </button>
            {msgNotif && <p className="text-sm font-medium text-gray-700">{msgNotif}</p>}
          </div>
        </div>
      )}

      {/* Conta */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Dados da conta</h2>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="label mb-1 block">Nome</label>
            <input type="text" className="input max-w-sm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label mb-1 block">E-mail</label>
            <input type="email" className="input max-w-sm bg-gray-50" value={profile?.email ?? ""} disabled readOnly />
            <p className="mt-1 text-xs text-gray-400">O e-mail não pode ser alterado.</p>
          </div>
          {family && (
            <div>
              <label className="label mb-1 block">Família</label>
              <input type="text" className="input max-w-sm bg-gray-50" value={family.name} disabled readOnly />
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

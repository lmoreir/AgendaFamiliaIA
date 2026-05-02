"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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

interface CalendarStatus {
  ical: { token: string } | null;
  icalImport: { url: string } | null;
  google: { connected: boolean; configured: boolean };
  syncInterval: "hourly" | "daily";
  lastSyncedAt: string | null;
}

function ConfiguracoesContent() {
  const searchParams = useSearchParams();

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

  // Calendário
  const [calStatus, setCalStatus] = useState<CalendarStatus | null>(null);
  const [calMsg, setCalMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [generatingIcal, setGeneratingIcal] = useState(false);
  const [copied, setCopied] = useState(false);
  // iCal import
  const [icalImportUrl, setIcalImportUrl] = useState("");
  const [savingIcalImport, setSavingIcalImport] = useState(false);
  // Intervalo de sincronização
  const [syncInterval, setSyncInterval] = useState<"hourly" | "daily">("hourly");
  const [savingSyncInterval, setSavingSyncInterval] = useState(false);

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

    fetch("/api/families")
      .then((r) => r.json())
      .then((data) => {
        if (data.family?.settings) {
          const s: FamilySettings = data.family.settings;
          setSecondaryPhone(s.secondary_whatsapp ?? "");
          setNotifyEmail(s.notify_email ?? false);
        }
      });

    fetch("/api/calendar/status")
      .then((r) => r.json())
      .then((data: CalendarStatus) => {
        setCalStatus(data);
        if (data.icalImport?.url) setIcalImportUrl(data.icalImport.url);
        if (data.syncInterval) setSyncInterval(data.syncInterval);
      })
      .catch(() => {});

    // Feedback from OAuth redirect
    const calParam = searchParams.get("calendar");
    const errParam = searchParams.get("error");
    if (calParam === "connected") setCalMsg("✅ Google Calendar conectado com sucesso!");
    else if (errParam === "google_denied") setCalMsg("❌ Autorização negada. Tente novamente.");
    else if (errParam === "google_no_refresh_token") setCalMsg("❌ Não foi possível obter o token. Tente novamente.");
    else if (errParam === "google_not_configured") setCalMsg("❌ Google Calendar não está configurado neste servidor.");
  }, [searchParams]);

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

  // --- Calendar helpers ---

  function formatLastSynced(iso: string | null): string {
    if (!iso) return "Nunca sincronizado";
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function saveSyncInterval(value: "hourly" | "daily") {
    setSyncInterval(value);
    setSavingSyncInterval(true);
    await fetch("/api/families", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendar_sync_interval: value }),
    });
    setSavingSyncInterval(false);
    setCalStatus((prev) => prev ? { ...prev, syncInterval: value } : prev);
  }

  function getIcalUrl(token: string): string {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/calendar/ical/${token}`;
    }
    return `/api/calendar/ical/${token}`;
  }

  async function generateIcalToken() {
    setGeneratingIcal(true);
    const res = await fetch("/api/calendar/ical/generate", { method: "POST" });
    const data = await res.json();
    setGeneratingIcal(false);
    if (res.ok) {
      setCalStatus((prev) => ({ ...prev!, ical: { token: data.token } }));
    }
  }

  async function copyIcalUrl() {
    if (!calStatus?.ical) return;
    await navigator.clipboard.writeText(getIcalUrl(calStatus.ical.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function syncGoogle() {
    setSyncing(true);
    setCalMsg("");
    const res = await fetch("/api/calendar/google/sync", { method: "POST" });
    const data = await res.json();
    setSyncing(false);
    if (res.ok) {
      setCalMsg(`✅ Sincronizado! ${data.created} criados, ${data.updated} atualizados, ${data.deleted} removidos.`);
    } else {
      setCalMsg(`❌ ${data.error ?? "Erro ao sincronizar."}`);
    }
  }

  async function saveIcalImport() {
    setSavingIcalImport(true);
    setCalMsg("");
    const res = await fetch("/api/calendar/ical/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: icalImportUrl }),
    });
    const data = await res.json();
    setSavingIcalImport(false);
    if (res.ok) {
      if (data.removed) {
        setCalStatus((prev) => ({ ...prev!, icalImport: null }));
        setCalMsg("Importação iCal removida.");
      } else {
        setCalStatus((prev) => ({ ...prev!, icalImport: { url: icalImportUrl } }));
        setCalMsg(`✅ Importados ${data.imported} novos eventos, ${data.updated} atualizados.`);
      }
    } else {
      setCalMsg(`❌ ${data.error ?? "Erro ao importar calendário."}`);
    }
  }

  async function removeIcalImport() {
    setCalMsg("");
    const res = await fetch("/api/calendar/ical/import", { method: "DELETE" });
    if (res.ok) {
      setCalStatus((prev) => ({ ...prev!, icalImport: null }));
      setIcalImportUrl("");
      setCalMsg("Importação iCal removida.");
    }
  }

  async function disconnectGoogle() {
    if (!confirm("Desconectar o Google Calendar? As atividades já exportadas permanecem na sua agenda do Google.")) return;
    setCalMsg("");
    const res = await fetch("/api/calendar/google/disconnect", { method: "POST" });
    if (res.ok) {
      setCalStatus((prev) => ({ ...prev!, google: { ...prev!.google, connected: false } }));
      setCalMsg("Google Calendar desconectado.");
    } else {
      setCalMsg("❌ Erro ao desconectar.");
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

      {/* Integrações de Calendário */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Integrações de calendário</h2>
        </div>
        <div className="card-body space-y-6">
          <p className="text-sm text-gray-600">
            O Agenda Família é a fonte central de dados. Você pode importar eventos de outros calendários para cá, e exportar sua agenda para apps externos.
          </p>

          {calMsg && (
            <div className={`rounded-lg p-3 text-sm font-medium ${calMsg.startsWith("✅") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {calMsg}
            </div>
          )}

          {/* Google Calendar — bidirecional */}
          <div className="space-y-3 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🗓️</span>
              <div>
                <p className="font-medium text-gray-900 text-sm">Google Calendar</p>
                <p className="text-xs text-gray-500">
                  Bidirecional — eventos do Google entram no app, atividades do app vão para o Google. Tudo passa pelas notificações.
                </p>
              </div>
            </div>

            {calStatus === null ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : !calStatus.google.configured ? (
              <div className="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-700">
                Integração requer configuração das variáveis GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no servidor.
              </div>
            ) : calStatus.google.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <span>✅</span>
                  <span className="font-medium">Google Calendar conectado — sincronização automática ativa</span>
                </div>

                {/* Frequência de sincronização */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">Frequência de sincronização automática</p>
                  <div className="flex gap-3">
                    {(["hourly", "daily"] as const).map((val) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="syncInterval"
                          value={val}
                          checked={syncInterval === val}
                          onChange={() => saveSyncInterval(val)}
                          disabled={savingSyncInterval}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <span className="text-sm text-gray-700">
                          {val === "hourly" ? "A cada hora" : "Uma vez ao dia"}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    Última sincronização: {formatLastSynced(calStatus.lastSyncedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary text-sm" onClick={syncGoogle} disabled={syncing}>
                    {syncing ? "Sincronizando..." : "Sincronizar agora"}
                  </button>
                  <button
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    onClick={disconnectGoogle}
                  >
                    Desconectar
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Eventos do Google entram no app (categoria Outro) e atividades do app são espelhadas no Google Calendar.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  Conecte sua conta Google para sincronizar eventos nos dois sentidos automaticamente.
                </p>
                <a href="/api/calendar/google/connect" className="btn-primary inline-block text-sm">
                  Conectar Google Calendar
                </a>
              </div>
            )}
          </div>

          {/* iCal Import — Apple Calendar, Outlook, qualquer .ics */}
          <div className="space-y-3 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📥</span>
              <div>
                <p className="font-medium text-gray-900 text-sm">Importar calendário externo (iCal / Apple Calendar)</p>
                <p className="text-xs text-gray-500">
                  Cole a URL de assinatura de qualquer calendário (.ics) — eventos entram no app automaticamente e recebem notificações.
                </p>
              </div>
            </div>

            {calStatus === null ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : (
              <div className="space-y-2">
                {calStatus.icalImport && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <span>✅</span>
                    <span className="truncate flex-1">{calStatus.icalImport.url}</span>
                    <button onClick={removeIcalImport} className="text-red-500 underline hover:text-red-700 shrink-0">
                      Remover
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                    className="input flex-1 text-xs"
                    value={icalImportUrl}
                    onChange={(e) => setIcalImportUrl(e.target.value)}
                  />
                  <button
                    className="btn-primary shrink-0 text-sm"
                    onClick={saveIcalImport}
                    disabled={savingIcalImport || !icalImportUrl.trim()}
                  >
                    {savingIcalImport ? "Importando..." : calStatus.icalImport ? "Atualizar" : "Importar"}
                  </button>
                </div>
                <details className="text-xs text-gray-500 pt-1">
                  <summary className="cursor-pointer hover:text-gray-700">Como obter a URL do Apple Calendar / Google Calendar</summary>
                  <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-100">
                    <p><strong>Apple Calendar (iPhone/Mac):</strong> Calendários → toque no ⓘ do calendário → Compartilhar calendário → ativar "Calendário público" → Copiar link</p>
                    <p><strong>Google Calendar:</strong> Configurações → clique no calendário → "Endereço secreto no formato iCal" → copie a URL</p>
                    <p><strong>Outlook:</strong> Configurações → Exibir todas as configurações → Calendário → Calendários compartilhados → Publicar calendário → copie o link ICS</p>
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* iCal Export — exportar do app */}
          <div className="space-y-3 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📤</span>
              <div>
                <p className="font-medium text-gray-900 text-sm">Exportar agenda (iCal)</p>
                <p className="text-xs text-gray-500">
                  Gere um link de assinatura para espelhar sua agenda no Apple Calendar, Outlook ou qualquer app .ics.
                </p>
              </div>
            </div>

            {calStatus === null ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : calStatus.ical ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Cole este link no seu app de calendário:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getIcalUrl(calStatus.ical.token)}
                    className="input flex-1 text-xs bg-gray-50 font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button className="btn-primary shrink-0 text-xs px-3 py-1.5" onClick={copyIcalUrl}>
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <button
                  className="text-xs text-gray-400 underline hover:text-gray-600"
                  onClick={generateIcalToken}
                  disabled={generatingIcal}
                >
                  {generatingIcal ? "Gerando..." : "Gerar novo link (invalida o atual)"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Gere um link privado de assinatura para adicionar sua agenda ao Apple Calendar ou outro app.</p>
                <button className="btn-primary text-sm" onClick={generateIcalToken} disabled={generatingIcal}>
                  {generatingIcal ? "Gerando..." : "Gerar link de exportação"}
                </button>
              </div>
            )}
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

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Carregando...</div>}>
      <ConfiguracoesContent />
    </Suspense>
  );
}

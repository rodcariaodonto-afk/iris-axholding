import { useEffect, useState, useCallback, ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Button } from "@/components/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type InputEv = ChangeEvent<HTMLInputElement>;
import {
  Plus, Smartphone, RefreshCw, Trash2, CheckCircle2, AlertCircle,
  QrCode, Loader2, Star, Server, Save,
} from "lucide-react";
import { toast } from "sonner";

type Provider = "evolution" | "meta_cloud";
type Status = "disconnected" | "qr_pending" | "connecting" | "connected" | "error";

interface LiveCheck {
  loading: boolean;
  live: boolean | null;
  reachable: boolean | null;
  evolution_state: string | null;
  reason?: string | null;
  checkedAt: number | null;
}

interface Session {
  id: string;
  account_id: string;
  provider: Provider;
  session_name: string;
  status: Status;
  phone_number: string | null;
  qr_code: string | null;
  error_message: string | null;
  is_default: boolean;
  evolution_instance_name: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  whatsapp_access_token: string | null;
  whatsapp_verify_token: string | null;
  last_connected_at: string | null;
}

interface AccountSettings {
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  max_sessions: number;
}

const statusMeta: Record<Status, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  connected:    { label: "Conectado",   cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  qr_pending:   { label: "Aguardando QR", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: QrCode },
  connecting:   { label: "Conectando…", cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30", icon: Loader2 },
  disconnected: { label: "Desconectado", cls: "bg-slate-500/10 text-slate-400 border-slate-500/30", icon: Smartphone },
  error:        { label: "Erro",         cls: "bg-red-500/10 text-red-400 border-red-500/30", icon: AlertCircle },
};

export default function WhatsAppSessions() {
  const { activeAccountId } = useActiveAccount();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<AccountSettings>({ evolution_api_url: "", evolution_api_key: "", max_sessions: 3 });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [liveChecks, setLiveChecks] = useState<Record<string, LiveCheck>>({});

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    const [{ data: ss }, { data: cfg }] = await Promise.all([
      (supabase as any).from("whatsapp_sessions").select("*").eq("account_id", activeAccountId).order("created_at"),
      (supabase as any).from("whatsapp_account_settings").select("*").eq("account_id", activeAccountId).maybeSingle(),
    ]);
    setSessions((ss as Session[]) || []);
    if (cfg) setSettings({ evolution_api_url: cfg.evolution_api_url, evolution_api_key: cfg.evolution_api_key, max_sessions: cfg.max_sessions });
    if (!selectedId && ss?.[0]) setSelectedId(ss[0].id);
    setLoading(false);
  }, [activeAccountId, selectedId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!activeAccountId) return;
    const ch = supabase.channel(`wa-sessions-${activeAccountId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_sessions", filter: `account_id=eq.${activeAccountId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeAccountId, load]);

  const selected = sessions.find(s => s.id === selectedId) || null;

  async function saveSettings() {
    if (!activeAccountId) return;
    setSavingSettings(true);
    const url = (settings.evolution_api_url || "").trim().replace(/\/$/, "");
    const { error } = await (supabase as any).from("whatsapp_account_settings").upsert({
      account_id: activeAccountId,
      evolution_api_url: url || null,
      evolution_api_key: settings.evolution_api_key || null,
      max_sessions: settings.max_sessions,
    }, { onConflict: "account_id" });
    setSavingSettings(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Servidor Evolution salvo");
  }

  async function connect(s: Session) {
    setActing(s.id);
    const { data, error } = await supabase.functions.invoke("whatsapp-session-connect", {
      body: { session_id: s.id },
    });
    setActing(null);
    if (error || data?.error) { toast.error("Falha ao conectar: " + (data?.error || error?.message)); return; }
    if (data?.qr_code) setQrOpen(true);
    else if (data?.status === "connected") toast.success("Conectado!");
    load();
  }
  const checkStatus = useCallback(async (s: Session, silent = false) => {
    setLiveChecks(prev => ({ ...prev, [s.id]: { ...(prev[s.id] || { live: null, reachable: null, evolution_state: null, checkedAt: null }), loading: true } }));
    const { data, error } = await supabase.functions.invoke("whatsapp-session-status", { body: { session_id: s.id } });
    if (error || data?.error) {
      setLiveChecks(prev => ({ ...prev, [s.id]: { loading: false, live: false, reachable: false, evolution_state: null, reason: data?.error || error?.message, checkedAt: Date.now() } }));
      if (!silent) toast.error("Falha ao verificar conexão");
    } else {
      setLiveChecks(prev => ({ ...prev, [s.id]: { loading: false, live: data?.live ?? null, reachable: data?.reachable ?? null, evolution_state: data?.evolution_state ?? null, reason: data?.reason ?? null, checkedAt: Date.now() } }));
      if (!silent) {
        if (data?.live) {
          toast.success("Conexão real confirmada (online)");
          if (data?.requeued > 0) toast.success(`${data.requeued} mensagem(ns) reenfileirada(s) para reenvio`);
        }
        else if (data?.reachable === false) toast.warning("Servidor Evolution inacessível");
        else toast.warning("WhatsApp não está conectado de verdade");
      } else if (data?.live && data?.requeued > 0) {
        toast.success(`${data.requeued} mensagem(ns) reenfileirada(s) automaticamente`);
      }
    }
    load();
  }, [load]);
  async function remove(s: Session) {
    if (!confirm(`Excluir sessão "${s.session_name}"? Esta ação não pode ser desfeita.`)) return;
    setActing(s.id);
    const { data, error } = await supabase.functions.invoke("whatsapp-session-delete", { body: { session_id: s.id } });
    setActing(null);
    if (error || data?.error) { toast.error("Falha: " + (data?.error || error?.message)); return; }
    toast.success("Sessão removida");
    if (selectedId === s.id) setSelectedId(null);
    load();
  }
  async function setDefault(s: Session) {
    if (!activeAccountId) return;
    await (supabase as any).from("whatsapp_sessions").update({ is_default: false }).eq("account_id", activeAccountId);
    await (supabase as any).from("whatsapp_sessions").update({ is_default: true }).eq("id", s.id);
    toast.success(`"${s.session_name}" agora é a sessão padrão`);
    load();
  }

  // Auto-verifica conexão real do Evolution ao selecionar uma sessão
  useEffect(() => {
    if (!selected || selected.provider !== "evolution") return;
    if (liveChecks[selected.id]?.checkedAt) return;
    checkStatus(selected, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.provider]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Lista */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Sessões ({sessions.length})</h3>
          <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nova
          </Button>
        </div>
        <div className="space-y-2">
          {sessions.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-10 border border-dashed border-slate-800 rounded-lg">
              Nenhuma sessão criada
            </div>
          )}
          {sessions.map(s => {
            const meta = statusMeta[s.status];
            const Icon = meta.icon;
            return (
              <button key={s.id} onClick={() => setSelectedId(s.id)}
                className={`w-full text-left p-3 rounded-lg border transition ${selectedId === s.id ? "bg-slate-800/60 border-cyan-500/40" : "bg-slate-900/40 border-slate-800 hover:border-slate-700"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-100 truncate">{s.session_name}</span>
                    {s.is_default && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`${meta.cls} text-[10px] gap-1`}>
                    <Icon className={`w-3 h-3 ${s.status === "connecting" ? "animate-spin" : ""}`} />
                    {meta.label}
                  </Badge>
                  <span className="text-[10px] text-slate-500">{s.provider === "meta_cloud" ? "Meta" : "Evolution"}</span>
                </div>
                {s.phone_number && <div className="text-xs text-slate-400 mt-1">{s.phone_number}</div>}
              </button>
            );
          })}
        </div>

        {/* Servidor Evolution */}
        <div className="mt-6 p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Server className="w-4 h-4" /> Servidor Evolution
          </div>
          <div className="space-y-2">
            <Label className="text-xs">URL</Label>
            <Input value={settings.evolution_api_url || ""} onChange={(e: InputEv) => setSettings({ ...settings, evolution_api_url: e.target.value })}
              placeholder="https://sua-evolution.com" className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">API Key</Label>
            <Input type="password" value={settings.evolution_api_key || ""} onChange={(e: InputEv) => setSettings({ ...settings, evolution_api_key: e.target.value })}
              placeholder="••••••••" className="font-mono text-xs" />
          </div>
          <Button size="sm" variant="secondary" onClick={saveSettings} disabled={savingSettings} className="w-full gap-2">
            {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </Button>
          <p className="text-[10px] text-slate-500">URL e chave compartilhadas por todas as instâncias Evolution desta Conta.</p>
        </div>
      </div>

      {/* Detalhes */}
      <div className="min-h-[400px]">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500 border border-dashed border-slate-800 rounded-lg">
            Selecione uma sessão à esquerda
          </div>
        ) : (
          <SessionDetail session={selected} acting={acting === selected.id}
            liveCheck={liveChecks[selected.id]}
            onConnect={() => connect(selected)} onCheck={() => checkStatus(selected)}
            onDelete={() => remove(selected)} onSetDefault={() => setDefault(selected)}
            onShowQR={() => setQrOpen(true)} onUpdated={load} />

        )}
      </div>

      <CreateSessionDialog open={createOpen} onOpenChange={setCreateOpen}
        accountId={activeAccountId!} onCreated={(id) => { setSelectedId(id); load(); }} />

      <QRDialog open={qrOpen} onOpenChange={setQrOpen} session={selected}
        onRefresh={() => selected && connect(selected)} />
    </div>
  );
}

function LiveIndicator({ liveCheck }: { liveCheck?: LiveCheck }) {
  if (!liveCheck || (liveCheck.loading && liveCheck.checkedAt === null)) {
    return (
      <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30 gap-1 text-[10px]">
        <Loader2 className="w-3 h-3 animate-spin" /> Verificando conexão real…
      </Badge>
    );
  }
  if (liveCheck.reachable === false) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1 text-[10px]" title={liveCheck.reason || undefined}>
        <AlertCircle className="w-3 h-3" /> Servidor Evolution inacessível
      </Badge>
    );
  }
  if (liveCheck.live === true) {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1 text-[10px]">
        <CheckCircle2 className="w-3 h-3" /> Conexão real: online
      </Badge>
    );
  }
  if (liveCheck.live === false) {
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 gap-1 text-[10px]">
        <AlertCircle className="w-3 h-3" /> Conexão real: offline{liveCheck.evolution_state ? ` (${liveCheck.evolution_state})` : ""}
      </Badge>
    );
  }
  return null;
}



function SessionDetail({ session, acting, liveCheck, onConnect, onCheck, onDelete, onSetDefault, onShowQR, onUpdated }: {
  session: Session; acting: boolean; liveCheck?: LiveCheck; onConnect: () => void; onCheck: () => void;
  onDelete: () => void; onSetDefault: () => void; onShowQR: () => void; onUpdated: () => void;
}) {
  const meta = statusMeta[session.status];
  const Icon = meta.icon;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    session_name: session.session_name,
    whatsapp_phone_number_id: session.whatsapp_phone_number_id || "",
    whatsapp_business_account_id: session.whatsapp_business_account_id || "",
    whatsapp_access_token: session.whatsapp_access_token || "",
    whatsapp_verify_token: session.whatsapp_verify_token || "",
  });

  useEffect(() => {
    setForm({
      session_name: session.session_name,
      whatsapp_phone_number_id: session.whatsapp_phone_number_id || "",
      whatsapp_business_account_id: session.whatsapp_business_account_id || "",
      whatsapp_access_token: session.whatsapp_access_token || "",
      whatsapp_verify_token: session.whatsapp_verify_token || "",
    });
  }, [session.id]);

  async function save() {
    const { error } = await (supabase as any).from("whatsapp_sessions").update(form).eq("id", session.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Salvo");
    setEditing(false);
    onUpdated();
  }

  return (
    <div className="space-y-5 p-5 rounded-lg border border-slate-800 bg-slate-900/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-white">{session.session_name}</h3>
            {session.is_default && <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">PADRÃO</Badge>}
          </div>
          <Badge variant="outline" className={`${meta.cls} gap-1`}>
            <Icon className={`w-3 h-3 ${session.status === "connecting" ? "animate-spin" : ""}`} />
            {meta.label}
          </Badge>
          {session.provider === "evolution" && <LiveIndicator liveCheck={liveCheck} />}
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          {session.status === "qr_pending" && session.qr_code && (
            <Button size="sm" variant="secondary" onClick={onShowQR} className="gap-1.5"><QrCode className="w-3.5 h-3.5" /> Ver QR</Button>
          )}
          <Button size="sm" variant="primary" onClick={onConnect} disabled={acting} className="gap-1.5">
            {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {session.status === "connected" ? "Reconectar" : "Conectar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCheck} disabled={acting || liveCheck?.loading} className="gap-1.5">
            {liveCheck?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Verificar conexão real
          </Button>
          {!session.is_default && (
            <Button size="sm" variant="ghost" onClick={onSetDefault} className="gap-1.5">
              <Star className="w-3.5 h-3.5" /> Tornar padrão
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300 gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {session.error_message && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {session.error_message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <Label className="text-xs text-slate-500">Provedor</Label>
          <div className="text-slate-200 mt-1">{session.provider === "meta_cloud" ? "Meta Cloud API" : "Evolution API"}</div>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Telefone</Label>
          <div className="text-slate-200 mt-1">{session.phone_number || "—"}</div>
        </div>
      </div>

      {/* Edit form */}
      <div className="border-t border-slate-800 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200">Configuração</h4>
          {!editing ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Editar</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button size="sm" variant="primary" onClick={save}>Salvar</Button>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={form.session_name} disabled={!editing} onChange={(e: InputEv) => setForm({ ...form, session_name: e.target.value })} />
          </div>
          {session.provider === "evolution" ? (
            <div>
              <Label className="text-xs">Nome da instância (Evolution)</Label>
              <Input value={session.evolution_instance_name || ""} disabled className="font-mono text-xs" />
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs">Phone Number ID</Label>
                <Input value={form.whatsapp_phone_number_id} disabled={!editing}
                  onChange={(e: InputEv) => setForm({ ...form, whatsapp_phone_number_id: e.target.value })} className="font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs">Business Account ID</Label>
                <Input value={form.whatsapp_business_account_id} disabled={!editing}
                  onChange={(e: InputEv) => setForm({ ...form, whatsapp_business_account_id: e.target.value })} className="font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs">Access Token</Label>
                <Input type="password" value={form.whatsapp_access_token} disabled={!editing}
                  onChange={(e: InputEv) => setForm({ ...form, whatsapp_access_token: e.target.value })} className="font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs">Verify Token</Label>
                <Input value={form.whatsapp_verify_token} disabled={!editing}
                  onChange={(e: InputEv) => setForm({ ...form, whatsapp_verify_token: e.target.value })} className="font-mono text-xs" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateSessionDialog({ open, onOpenChange, accountId, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; accountId: string; onCreated: (id: string) => void;
}) {
  const [provider, setProvider] = useState<Provider>("evolution");
  const [name, setName] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [meta, setMeta] = useState({ phone_id: "", waba: "", token: "", verify: "" });
  const [creating, setCreating] = useState(false);

  async function submit() {
    if (!name.trim()) { toast.error("Informe um nome"); return; }
    setCreating(true);
    const body: any = { account_id: accountId, provider, session_name: name.trim() };
    if (provider === "evolution") {
      const normalizedInstance = instanceName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (normalizedInstance) body.evolution_instance_name = normalizedInstance;
    } else {
      if (!meta.phone_id || !meta.token) { toast.error("Phone Number ID e Token são obrigatórios"); setCreating(false); return; }
      body.whatsapp_phone_number_id = meta.phone_id;
      body.whatsapp_business_account_id = meta.waba;
      body.whatsapp_access_token = meta.token;
      body.whatsapp_verify_token = meta.verify || "iris-" + Math.random().toString(36).slice(2, 10);
    }
    const { data, error } = await supabase.functions.invoke("whatsapp-session-create", { body });
    setCreating(false);
    if (error || data?.error) {
      const msg = data?.error === "limit_reached"
        ? `Limite de sessões atingido (${data.current}/${data.limit})`
        : (data?.error || error?.message);
      toast.error("Falha: " + msg);
      return;
    }
    toast.success("Sessão criada");
    onCreated(data.session.id);
    onOpenChange(false);
    setName(""); setInstanceName(""); setMeta({ phone_id: "", waba: "", token: "", verify: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova sessão de WhatsApp</DialogTitle>
          <DialogDescription>Conecte um novo número à sua Conta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Provedor</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="evolution">Evolution API</SelectItem>
                <SelectItem value="meta_cloud">Meta Cloud API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome da sessão</Label>
            <Input value={name} onChange={(e: InputEv) => setName(e.target.value)} placeholder="Ex: Vendas, Suporte..." />
          </div>
          {provider === "evolution" ? (
            <div>
              <Label>Nome da instância (opcional)</Label>
              <Input value={instanceName} onChange={(e: InputEv) => setInstanceName(e.target.value)}
                placeholder="deixe vazio para gerar uma instância única" className="font-mono text-xs" />
              <p className="text-[10px] text-slate-500 mt-1">Use um nome exclusivo. Se deixar vazio, criaremos um nome único automaticamente.</p>
            </div>
          ) : (
            <>
              <div><Label>Phone Number ID</Label><Input value={meta.phone_id} onChange={(e: InputEv) => setMeta({ ...meta, phone_id: e.target.value })} className="font-mono text-xs" /></div>
              <div><Label>Business Account ID</Label><Input value={meta.waba} onChange={(e: InputEv) => setMeta({ ...meta, waba: e.target.value })} className="font-mono text-xs" /></div>
              <div><Label>Access Token</Label><Input type="password" value={meta.token} onChange={(e: InputEv) => setMeta({ ...meta, token: e.target.value })} className="font-mono text-xs" /></div>
              <div><Label>Verify Token (opcional)</Label><Input value={meta.verify} onChange={(e: InputEv) => setMeta({ ...meta, verify: e.target.value })} className="font-mono text-xs" /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="primary" onClick={submit} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar sessão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QRDialog({ open, onOpenChange, session, onRefresh }: {
  open: boolean; onOpenChange: (v: boolean) => void; session: Session | null; onRefresh: () => void;
}) {
  if (!session) return null;
  const qr = session.qr_code;
  const isImg = qr?.startsWith("data:image");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Escaneie o QR Code</DialogTitle>
          <DialogDescription>Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-4 bg-white rounded-lg">
          {qr ? (
            isImg ? <img src={qr} alt="QR Code" className="w-64 h-64" />
                  : <div className="text-xs font-mono text-slate-700 break-all">{qr}</div>
          ) : (
            <div className="w-64 h-64 flex items-center justify-center text-slate-500">Sem QR disponível</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="primary" onClick={onRefresh} className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Gerar novo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

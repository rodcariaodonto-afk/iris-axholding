import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, Users as UsersIcon, Plus, Copy, Check, ExternalLink, MoreVertical, Pause, Play, Trash2, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-border/40 ${className}`}>{children}</span>
);
import { format, differenceInDays } from "date-fns";

interface AccountRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  is_internal: boolean;
  created_at: string;
  delete_after?: string | null;
  deletion_status?: string | null;
  member_count?: number;
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  suspended: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

type ActionType = "suspend" | "reactivate" | "delete" | "cancel_deletion";

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", plan: "starter", role: "owner" });
  const [resultLink, setResultLink] = useState<{ url: string; emailSent: boolean; emailError: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  // action dialog state
  const [pendingAction, setPendingAction] = useState<{ account: AccountRow; action: ActionType } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionConfirm, setActionConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data: accs } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
    const withCounts = await Promise.all((accs || []).map(async (a: any) => {
      const { count } = await supabase.from("account_members").select("id", { count: "exact", head: true }).eq("account_id", a.id).eq("status", "active");
      return { ...a, member_count: count || 0 };
    }));
    setAccounts(withCounts as AccountRow[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const filtered = accounts.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.slug.includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error("Preencha nome e email"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("super-admin-create-client", { body: form });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar conta");
      setResultLink({ url: data.acceptUrl, emailSent: !!data.emailSent, emailError: data.emailError });
      toast.success("Conta criada!");
      reload();
    } catch (e: any) {
      toast.error(e.message || "Falha ao criar conta");
    } finally { setCreating(false); }
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setForm({ name: "", email: "", plan: "starter", role: "owner" });
    setResultLink(null);
    setCopied(false);
  };

  const copyLink = async () => {
    if (!resultLink) return;
    await navigator.clipboard.writeText(resultLink.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeAction = () => {
    setPendingAction(null);
    setActionReason("");
    setActionConfirm(false);
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.action === "delete" && !actionConfirm) {
      toast.error("Confirme que entendeu antes de prosseguir");
      return;
    }
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("super-admin-account-action", {
        body: { account_id: pendingAction.account.id, action: pendingAction.action, reason: actionReason || undefined },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro");
      toast.success({
        suspend: "Conta suspensa e IA pausada",
        reactivate: "Conta reativada",
        delete: "Conta agendada para exclusão (30 dias para reverter)",
        cancel_deletion: "Exclusão cancelada — conta reativada",
      }[pendingAction.action]);
      closeAction();
      reload();
    } catch (e: any) {
      toast.error(e.message || "Falha na operação");
    } finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const ACTION_LABELS: Record<ActionType, { title: string; desc: string; confirm: string }> = {
    suspend: {
      title: "Suspender conta",
      desc: "O acesso de todos os usuários da conta será bloqueado e a IA será pausada (não responderá novas mensagens). Os dados ficam preservados e você pode reativar a qualquer momento.",
      confirm: "Suspender",
    },
    reactivate: {
      title: "Reativar conta",
      desc: "A conta voltará ao status ativo, usuários poderão logar normalmente e a IA será religada.",
      confirm: "Reativar",
    },
    delete: {
      title: "Excluir conta",
      desc: "A conta será marcada como cancelada e agendada para exclusão definitiva em 30 dias. Durante esse período, você pode reverter. Após 30 dias, todos os dados são apagados permanentemente.",
      confirm: "Agendar exclusão",
    },
    cancel_deletion: {
      title: "Cancelar exclusão",
      desc: "A exclusão agendada será cancelada e a conta voltará ao estado ativo.",
      confirm: "Cancelar exclusão",
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Contas ({accounts.length})</h2>
          <p className="text-sm text-muted-foreground">Todas as contas no sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar por nome ou slug..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-4 h-4" /> Criar Cliente</Button>
        </div>
      </div>

      <div className="rounded-xl bg-card border border-border/40 divide-y divide-border/40">
        {filtered.map((a) => {
          const daysLeft = a.delete_after ? differenceInDays(new Date(a.delete_after), new Date()) : null;
          return (
            <div key={a.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2">
                  {a.name}
                  {a.is_internal && <Badge className="text-[10px]">Interna</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">/{a.slug} · criada em {format(new Date(a.created_at), "dd/MM/yyyy")}</div>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><UsersIcon className="w-3.5 h-3.5" />{a.member_count}</div>
              <Badge className="capitalize">{a.plan}</Badge>
              <Badge className={STATUS_COLOR[a.status] || ""}>{a.status}</Badge>
              {a.status === "cancelled" && daysLeft !== null && (
                <Badge className="bg-destructive/10 text-destructive border-destructive/30">
                  {daysLeft > 0 ? `Exclusão em ${daysLeft}d` : "Exclusão iminente"}
                </Badge>
              )}
              {!a.is_internal && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-52 p-1">
                    {a.status === "active" && (
                      <>
                        <ActionItem icon={<Pause className="w-4 h-4" />} label="Suspender conta" onClick={() => setPendingAction({ account: a, action: "suspend" })} />
                        <ActionItem icon={<Trash2 className="w-4 h-4" />} label="Excluir conta" danger onClick={() => setPendingAction({ account: a, action: "delete" })} />
                      </>
                    )}
                    {a.status === "suspended" && (
                      <>
                        <ActionItem icon={<Play className="w-4 h-4" />} label="Reativar conta" onClick={() => setPendingAction({ account: a, action: "reactivate" })} />
                        <ActionItem icon={<Trash2 className="w-4 h-4" />} label="Excluir conta" danger onClick={() => setPendingAction({ account: a, action: "delete" })} />
                      </>
                    )}
                    {a.status === "cancelled" && (
                      <ActionItem icon={<Undo2 className="w-4 h-4" />} label="Cancelar exclusão" onClick={() => setPendingAction({ account: a, action: "cancel_deletion" })} />
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground">Nenhuma conta encontrada.</div>}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && closeCreate()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar nova conta cliente</DialogTitle>
            <DialogDescription>Crie a conta e gere um link para o cliente definir a senha de acesso.</DialogDescription>
          </DialogHeader>
          {!resultLink ? (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome da empresa / cliente</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Padaria do João" /></div>
              <div className="space-y-2"><Label>Email do cliente</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@empresa.com" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Plano</Label>
                  <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Papel inicial</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreate}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Criar conta</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <div className="font-medium text-emerald-600 dark:text-emerald-400 mb-1">✓ Conta criada com sucesso</div>
                <div className="text-xs text-muted-foreground">{resultLink.emailSent ? "Email com link enviado ao cliente." : `Email não enviado (${resultLink.emailError || "verifique configuração"}). Use o link abaixo manualmente:`}</div>
              </div>
              <div className="space-y-2">
                <Label>Link de acesso (válido por 7 dias)</Label>
                <div className="flex gap-2">
                  <Input value={resultLink.url} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copyLink} title="Copiar">{copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}</Button>
                  <Button variant="outline" size="icon" asChild title="Abrir"><a href={resultLink.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a></Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Envie este link pelo WhatsApp ou outro canal de sua preferência.</p>
              </div>
              <DialogFooter><Button onClick={closeCreate}>Concluir</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action confirmation */}
      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && closeAction()}>
        <AlertDialogContent>
          {pendingAction && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{ACTION_LABELS[pendingAction.action].title}: {pendingAction.account.name}</AlertDialogTitle>
                <AlertDialogDescription>{ACTION_LABELS[pendingAction.action].desc}</AlertDialogDescription>
              </AlertDialogHeader>
              {pendingAction.action === "delete" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Motivo (opcional)</Label>
                    <Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Ex: cliente solicitou cancelamento, conta de teste, inadimplência..." rows={2} />
                  </div>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox checked={actionConfirm} onCheckedChange={(c) => setActionConfirm(!!c)} className="mt-0.5" />
                    <span>Entendo que após 30 dias todos os dados desta conta serão apagados permanentemente e <b>não poderão ser recuperados</b>.</span>
                  </label>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); executeAction(); }}
                  disabled={actionLoading || (pendingAction.action === "delete" && !actionConfirm)}
                  className={pendingAction.action === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {ACTION_LABELS[pendingAction.action].confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActionItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-left hover:bg-secondary ${danger ? "text-destructive hover:bg-destructive/10" : ""}`}
    >
      {icon}{label}
    </button>
  );
}

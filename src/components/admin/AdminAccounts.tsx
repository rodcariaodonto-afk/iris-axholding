import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, Users as UsersIcon, Plus, Copy, Check, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-border/40 ${className}`}>{children}</span>
);
import { format } from "date-fns";

interface AccountRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  is_internal: boolean;
  created_at: string;
  member_count?: number;
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  suspended: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", plan: "starter", role: "owner" });
  const [resultLink, setResultLink] = useState<{ url: string; emailSent: boolean; emailError: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

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
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Preencha nome e email");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("super-admin-create-client", { body: form });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar conta");
      setResultLink({ url: data.acceptUrl, emailSent: !!data.emailSent, emailError: data.emailError });
      toast.success("Conta criada! Use o link abaixo para liberar o acesso.");
      reload();
    } catch (e: any) {
      toast.error(e.message || "Falha ao criar conta");
    } finally {
      setCreating(false);
    }
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

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Contas ({accounts.length})</h2>
          <p className="text-sm text-muted-foreground">Todas as contas no sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar por nome ou slug..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Criar Cliente
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-card border border-border/40 divide-y divide-border/40">
        {filtered.map((a) => (
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
          </div>
        ))}
        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground">Nenhuma conta encontrada.</div>}
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => !o && closeCreate()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar nova conta cliente</DialogTitle>
            <DialogDescription>
              Crie a conta e gere um link para o cliente definir a senha de acesso.
            </DialogDescription>
          </DialogHeader>

          {!resultLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da empresa / cliente</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Padaria do João" />
              </div>
              <div className="space-y-2">
                <Label>Email do cliente</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@empresa.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Papel inicial</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreate}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Criar conta
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <div className="font-medium text-emerald-600 dark:text-emerald-400 mb-1">✓ Conta criada com sucesso</div>
                <div className="text-xs text-muted-foreground">
                  {resultLink.emailSent
                    ? "Email com link enviado ao cliente."
                    : `Email não enviado (${resultLink.emailError || "verifique configuração"}). Use o link abaixo manualmente:`}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link de acesso (válido por 7 dias)</Label>
                <div className="flex gap-2">
                  <Input value={resultLink.url} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copyLink} title="Copiar">
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="icon" asChild title="Abrir">
                    <a href={resultLink.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Envie este link pelo WhatsApp ou outro canal de sua preferência. O cliente clica e define a própria senha.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={closeCreate}>Concluir</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

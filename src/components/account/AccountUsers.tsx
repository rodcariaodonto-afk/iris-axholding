import { useEffect, useState } from "react";
import { useActiveAccount, type AccountRole } from "@/hooks/useActiveAccount";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ALL_ROLES, ROLE_LABEL, canManageUsers } from "@/lib/permissions";
import { toast } from "sonner";
import { Loader2, UserPlus, Mail, Trash2, Crown, Copy } from "lucide-react";

interface MemberRow {
  id: string;
  user_id: string;
  role: AccountRole;
  status: string;
  joined_at: string;
  profile?: { full_name: string | null } | null;
  email?: string | null;
}

interface InviteRow {
  id: string;
  email: string;
  role: AccountRole;
  token: string;
  expires_at: string;
  created_at: string;
}

export default function AccountUsers() {
  const { activeAccountId, role, refresh } = useActiveAccount();
  const canManage = canManageUsers(role);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AccountRole>("sdr");
  const [sendingInvite, setSendingInvite] = useState(false);

  const load = async () => {
    if (!activeAccountId) return;
    setLoading(true);

    const { data: mems } = await supabase
      .from("account_members")
      .select("id, user_id, role, status, joined_at")
      .eq("account_id", activeAccountId)
      .eq("status", "active")
      .order("joined_at", { ascending: true });

    // Buscar nomes dos perfis
    const userIds = (mems || []).map((m) => m.user_id);
    let profilesMap: Record<string, { full_name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, full_name").in("user_id", userIds);
      profilesMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
    }

    setMembers((mems || []).map((m) => ({ ...m, profile: profilesMap[m.user_id] || null } as MemberRow)));

    const { data: invs } = await supabase
      .from("account_invites")
      .select("id, email, role, token, expires_at, created_at")
      .eq("account_id", activeAccountId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    setInvites((invs || []) as InviteRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeAccountId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeAccountId) return;
    setSendingInvite(true);
    const { data, error } = await supabase.functions.invoke("account-invite", {
      body: { account_id: activeAccountId, email: inviteEmail.trim(), role: inviteRole },
    });
    setSendingInvite(false);
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Erro ao enviar convite");
      return;
    }
    if (data?.emailSent) toast.success("Convite enviado por email");
    else toast.warning(`Convite criado (email não enviado: ${data?.emailError || "configure Resend"})`);
    setShowInvite(false);
    setInviteEmail("");
    setInviteRole("sdr");
    load();
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const revokeInvite = async (id: string) => {
    await supabase.from("account_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    toast.success("Convite revogado");
    load();
  };

  const updateRole = async (memberId: string, newRole: AccountRole) => {
    await supabase.from("account_members").update({ role: newRole }).eq("id", memberId);
    toast.success("Papel atualizado");
    load();
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Remover este usuário da conta?")) return;
    await supabase.from("account_members").update({ status: "disabled" }).eq("id", memberId);
    toast.success("Usuário removido");
    load();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Membros e convites</h2>
          <p className="text-sm text-muted-foreground">Gerencie quem tem acesso a esta conta.</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> Convidar usuário
          </Button>
        )}
      </div>

      {/* Membros */}
      <div className="rounded-xl bg-card border border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 text-sm font-semibold">Membros ativos</div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum membro encontrado.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {members.map((m) => (
              <div key={m.id} className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  {(m.profile?.full_name || "U").substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{m.profile?.full_name || m.user_id}</span>
                    {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-yellow-500" />}
                  </div>
                  <div className="text-xs text-muted-foreground">Entrou em {new Date(m.joined_at).toLocaleDateString("pt-BR")}</div>
                </div>
                {canManage && m.role !== "owner" ? (
                  <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as AccountRole)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.filter((r) => r !== "owner").map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-medium text-primary">{ROLE_LABEL[m.role]}</span>
                )}
                {canManage && m.role !== "owner" && (
                  <Button variant="ghost" size="icon" onClick={() => removeMember(m.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Convites pendentes */}
      <div className="rounded-xl bg-card border border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 text-sm font-semibold">Convites pendentes</div>
        {invites.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum convite pendente.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {invites.map((inv) => (
              <div key={inv.id} className="p-4 flex items-center gap-4">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {ROLE_LABEL[inv.role]} · expira {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                {canManage && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => copyInviteLink(inv.token)}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Link
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => revokeInvite(inv.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="usuario@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AccountRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.filter((r) => r !== "owner").map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={sendingInvite || !inviteEmail.trim()}>
              {sendingInvite && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

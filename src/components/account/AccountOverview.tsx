import { useEffect, useState } from "react";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canManageAccount } from "@/lib/permissions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AccountOverview() {
  const { activeAccountId, role, refresh, memberships } = useActiveAccount();
  const account = memberships.find((m) => m.account_id === activeAccountId)?.account;
  const [name, setName] = useState(account?.name || "");
  const [logoUrl, setLogoUrl] = useState(account?.logo_url || "");
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<{ contacts: number; deals: number; conversations: number; members: number }>({ contacts: 0, deals: 0, conversations: 0, members: 0 });

  useEffect(() => {
    setName(account?.name || "");
    setLogoUrl(account?.logo_url || "");
  }, [account?.id]);

  useEffect(() => {
    if (!activeAccountId) return;
    (async () => {
      const [{ count: contacts }, { count: deals }, { count: conversations }, { count: members }] = await Promise.all([
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("account_id", activeAccountId),
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("account_id", activeAccountId),
        supabase.from("conversations").select("*", { count: "exact", head: true }).eq("account_id", activeAccountId),
        supabase.from("account_members").select("*", { count: "exact", head: true }).eq("account_id", activeAccountId).eq("status", "active"),
      ]);
      setCounts({ contacts: contacts || 0, deals: deals || 0, conversations: conversations || 0, members: members || 0 });
    })();
  }, [activeAccountId]);

  const canEdit = canManageAccount(role);

  const handleSave = async () => {
    if (!activeAccountId) return;
    setSaving(true);
    const { error } = await supabase
      .from("accounts")
      .update({ name, logo_url: logoUrl || null })
      .eq("id", activeAccountId);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Conta atualizada");
    refresh();
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Membros", value: counts.members },
          { label: "Contatos", value: counts.contacts },
          { label: "Conversas", value: counts.conversations },
          { label: "Deals", value: counts.deals },
        ].map((c) => (
          <div key={c.label} className="p-4 rounded-xl bg-card border border-border/40">
            <div className="text-2xl font-bold">{c.value.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-5 p-6 rounded-xl bg-card border border-border/40">
        <h2 className="text-lg font-semibold">Identidade</h2>
        <div className="space-y-2">
          <Label>Nome da conta</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input value={account?.slug || ""} disabled />
        </div>
        <div className="space-y-2">
          <Label>Logo URL</Label>
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label>Plano</Label>
          <Input value={account?.plan || "starter"} disabled />
          <p className="text-xs text-muted-foreground">Gerenciamento de planos chega na Fase 3.</p>
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar alterações
          </Button>
        )}
      </div>
    </div>
  );
}

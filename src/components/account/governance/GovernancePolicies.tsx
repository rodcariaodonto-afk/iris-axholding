import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const BASES = ["consent", "contract", "legitimate_interest", "legal_obligation", "vital_interests", "public_task"];

export default function GovernancePolicies() {
  const { activeAccountId, role } = useActiveAccount();
  const [p, setP] = useState<any>({
    retention_days_after_cancel: 30, audit_retention_days: 365,
    require_dsar_approval: true, default_legal_basis: "legitimate_interest",
    dpo_email: "", privacy_policy_url: "", terms_url: "",
  });
  const [saving, setSaving] = useState(false);
  const canEdit = role === "owner" || role === "admin";

  useEffect(() => {
    if (!activeAccountId) return;
    (async () => {
      const { data } = await supabase.from("account_policies").select("*").eq("account_id", activeAccountId).maybeSingle();
      if (data) setP(data);
    })();
  }, [activeAccountId]);

  const save = async () => {
    if (!activeAccountId) return;
    setSaving(true);
    const { error } = await supabase.from("account_policies").upsert({
      account_id: activeAccountId,
      retention_days_after_cancel: p.retention_days_after_cancel,
      audit_retention_days: p.audit_retention_days,
      require_dsar_approval: p.require_dsar_approval,
      default_legal_basis: p.default_legal_basis,
      dpo_email: p.dpo_email || null,
      privacy_policy_url: p.privacy_policy_url || null,
      terms_url: p.terms_url || null,
    });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Políticas salvas");
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Políticas de governança</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Retenção após cancelamento (dias)</Label>
            <Input type="number" value={p.retention_days_after_cancel} onChange={(e) => setP({ ...p, retention_days_after_cancel: +e.target.value })} disabled={!canEdit} />
          </div>
          <div><Label>Retenção de logs (dias)</Label>
            <Input type="number" value={p.audit_retention_days} onChange={(e) => setP({ ...p, audit_retention_days: +e.target.value })} disabled={!canEdit} />
          </div>
        </div>
        <div className="flex items-center justify-between border border-border/30 rounded-md p-3">
          <div><Label>Exigir aprovação para pedidos DSAR</Label><p className="text-xs text-muted-foreground">Resoluções aguardam revisão de admin.</p></div>
          <Switch checked={p.require_dsar_approval} onCheckedChange={(v) => setP({ ...p, require_dsar_approval: v })} disabled={!canEdit} />
        </div>
        <div><Label>Base legal padrão</Label>
          <Select value={p.default_legal_basis ?? ""} onValueChange={(v) => setP({ ...p, default_legal_basis: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BASES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Email do DPO/Encarregado</Label><Input type="email" value={p.dpo_email ?? ""} onChange={(e) => setP({ ...p, dpo_email: e.target.value })} disabled={!canEdit} /></div>
        <div><Label>URL Política de Privacidade</Label><Input value={p.privacy_policy_url ?? ""} onChange={(e) => setP({ ...p, privacy_policy_url: e.target.value })} disabled={!canEdit} /></div>
        <div><Label>URL Termos de Uso</Label><Input value={p.terms_url ?? ""} onChange={(e) => setP({ ...p, terms_url: e.target.value })} disabled={!canEdit} /></div>
        {canEdit && <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar políticas"}</Button>}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ShieldAlert, Database, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

export default function AccountSecurity() {
  const { user } = useAuth();
  const { activeAccountId, role } = useActiveAccount();
  const [newPwd, setNewPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleChangePwd = async () => {
    if (newPwd.length < 8) return toast.error("Senha precisa de no mínimo 8 caracteres");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Senha alterada com sucesso");
    setNewPwd("");
  };

  const handleExport = async () => {
    if (!activeAccountId) return;
    setExporting(true);
    const { data, error } = await supabase.functions.invoke("account-export", { body: { account_id: activeAccountId } });
    setExporting(false);
    if (error || !data?.url) return toast.error("Erro ao exportar: " + (error?.message || "desconhecido"));
    toast.success("Export pronto. Baixando...");
    window.open(data.url, "_blank");
  };

  const handleCancel = async () => {
    if (!activeAccountId) return;
    if (confirmText !== "CANCELAR") return toast.error('Digite "CANCELAR" para confirmar');
    setCancelling(true);
    const { error } = await supabase.functions.invoke("account-cancel", { body: { account_id: activeAccountId, confirm: "CANCELAR" } });
    setCancelling(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Conta cancelada. Dados serão removidos em 30 dias.");
    setConfirmText("");
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Segurança</h2>
        <p className="text-sm text-muted-foreground">Conta de acesso, sessão e dados.</p>
      </div>

      <div className="p-6 rounded-xl bg-card border border-border/40 space-y-4">
        <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /><h3 className="font-semibold">Trocar senha</h3></div>
        <div className="space-y-2"><Label>Email</Label><Input value={user?.email || ""} disabled /></div>
        <div className="space-y-2">
          <Label>Nova senha</Label>
          <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Mínimo 8 caracteres" />
        </div>
        <Button onClick={handleChangePwd} disabled={saving || !newPwd}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar nova senha
        </Button>
      </div>

      <div className="p-6 rounded-xl bg-card border border-border/40 space-y-3">
        <div className="flex items-center gap-2"><Database className="w-4 h-4 text-primary" /><h3 className="font-semibold">Dados da conta</h3></div>
        <p className="text-sm text-muted-foreground">Baixe um JSON completo com contatos, conversas, mensagens, deals e agendamentos.</p>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Exportar dados
        </Button>
      </div>

      {role === "owner" && (
        <div className="p-6 rounded-xl bg-destructive/5 border border-destructive/30 space-y-3">
          <div className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-destructive" /><h3 className="font-semibold text-destructive">Zona perigosa</h3></div>
          <p className="text-sm text-muted-foreground">Cancelar a conta suspende o acesso imediatamente. Os dados são apagados após 30 dias.</p>
          <div className="space-y-2">
            <Label>Digite <span className="font-mono font-bold">CANCELAR</span> para confirmar</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="CANCELAR" />
          </div>
          <Button variant="destructive" onClick={handleCancel} disabled={cancelling || confirmText !== "CANCELAR"}>
            {cancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Cancelar conta
          </Button>
        </div>
      )}
    </div>
  );
}

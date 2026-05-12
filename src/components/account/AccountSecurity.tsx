import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ShieldAlert, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AccountSecurity() {
  const { user } = useAuth();
  const [newPwd, setNewPwd] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePwd = async () => {
    if (newPwd.length < 8) return toast.error("Senha precisa de no mínimo 8 caracteres");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Senha alterada com sucesso");
    setNewPwd("");
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Segurança</h2>
        <p className="text-sm text-muted-foreground">Conta de acesso, sessão e dados.</p>
      </div>

      <div className="p-6 rounded-xl bg-card border border-border/40 space-y-4">
        <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /><h3 className="font-semibold">Trocar senha</h3></div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email || ""} disabled />
        </div>
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
        <p className="text-sm text-muted-foreground">Exportação completa, retenção e exclusão chegam na Fase 3.</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled>Exportar dados</Button>
          <Button variant="outline" disabled>Política de retenção</Button>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-destructive/5 border border-destructive/30 space-y-3">
        <div className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-destructive" /><h3 className="font-semibold text-destructive">Zona perigosa</h3></div>
        <p className="text-sm text-muted-foreground">Excluir esta conta apaga todos os dados associados. Disponível na Fase 3.</p>
        <Button variant="destructive" disabled>Excluir conta</Button>
      </div>
    </div>
  );
}

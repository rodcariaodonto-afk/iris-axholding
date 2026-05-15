import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, User, Building2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL } from "@/lib/permissions";
import { setActiveAccountId } from "@/lib/activeAccount";

interface InvitePreview {
  email: string;
  role: keyof typeof ROLE_LABEL;
  account: { id: string; name: string; logo_url: string | null };
  expires_at: string;
}

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase.functions.invoke("account-invite-accept", {
        body: { token, action: "preview" },
      });
      if (error || data?.error) {
        setError(data?.error || error?.message || "Convite inválido");
      } else {
        setPreview(data as InvitePreview);
      }
      setLoading(false);
    })();
  }, [token]);

  const acceptWithUser = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("account-invite-accept", {
      body: { token, user_id: userId, action: "accept" },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro ao aceitar convite");
      return false;
    }
    if (data?.account_id) {
      setActiveAccountId(data.account_id);
      try { await supabase.rpc("set_active_account", { _account_id: data.account_id }); } catch {}
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    setSubmitting(true);

    try {
      let userId: string | null = null;

      if (user) {
        // Já logado — confere se é o email do convite
        if ((user.email || "").toLowerCase() !== preview.email.toLowerCase()) {
          toast.error(`Faça logout. O convite é para ${preview.email}.`);
          return;
        }
        userId = user.id;
      } else if (mode === "signup") {
        const { data, error } = await supabase.functions.invoke("account-invite-accept", {
          body: { token, action: "signup", password, full_name: fullName },
        });
        if (error || data?.error) { toast.error(data?.error || error?.message || "Erro ao criar conta"); return; }
        const { data: sd, error: se } = await supabase.auth.signInWithPassword({ email: preview.email, password });
        if (se) { toast.error(se.message); return; }
        userId = sd.user?.id || data?.user_id || null;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: preview.email,
          password,
        });
        if (error) { toast.error(error.message); return; }
        userId = data.user?.id || null;
      }

      if (!userId) { toast.error("Não foi possível identificar o usuário"); return; }

      const ok = await acceptWithUser(userId);
      if (ok) {
        setAccepted(true);
        toast.success("Convite aceito! Redirecionando...");
        setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-card border border-destructive/30 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Convite inválido</h1>
          <p className="text-sm text-muted-foreground mb-6">{error || "Link inválido ou expirado."}</p>
          <Link to="/auth"><Button variant="outline">Ir para login</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            {preview.account.logo_url ? (
              <img src={preview.account.logo_url} alt={preview.account.name} className="w-12 h-12 object-contain rounded-lg" />
            ) : (
              <Building2 className="w-8 h-8 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-bold">{preview.account.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Você foi convidado(a) como <span className="font-semibold text-primary">{ROLE_LABEL[preview.role]}</span>
          </p>
        </div>

        {accepted ? (
          <div className="p-8 rounded-2xl bg-card border border-emerald-500/30 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold">Tudo certo!</p>
            <p className="text-sm text-muted-foreground">Redirecionando para o dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={preview.email} disabled className="pl-9" />
              </div>
            </div>

            {!user && (
              <>
                <div className="flex gap-1 p-1 bg-secondary/30 rounded-lg">
                  <button type="button" onClick={() => setMode("signup")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    Criar conta
                  </button>
                  <button type="button" onClick={() => setMode("login")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    Já tenho conta
                  </button>
                </div>

                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label>Nome completo</Label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-9" required />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" required minLength={6} />
                  </div>
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {user ? "Aceitar convite" : mode === "signup" ? "Criar conta e aceitar" : "Entrar e aceitar"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Expira em {new Date(preview.expires_at).toLocaleDateString("pt-BR")}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

import { useAccountUsage } from "@/hooks/useAccountUsage";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Loader2, Check, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const color = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toLocaleString("pt-BR")} / {max >= 999999 ? "∞" : max.toLocaleString("pt-BR")}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AccountPlan() {
  const { plan, usage, loading } = useAccountUsage();
  const { role } = useActiveAccount();
  const [allPlans, setAllPlans] = useState<any[]>([]);

  useEffect(() => {
    (supabase as any).from("account_plans").select("*").eq("is_public", true).order("position").then(({ data }: any) => setAllPlans(data || []));
  }, []);

  if (loading || !plan) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Plano e uso</h2>
        <p className="text-sm text-muted-foreground">Acompanhe consumo e faça upgrade quando precisar.</p>
      </div>

      <div className="p-6 rounded-xl bg-card border border-border/40 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Plano atual</div>
            <div className="text-2xl font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-primary" />{plan.name}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{plan.price_monthly > 0 ? `R$ ${plan.price_monthly.toLocaleString("pt-BR")}` : "Grátis"}</div>
            <div className="text-xs text-muted-foreground">/mês</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Bar value={usage.users} max={plan.max_users} label="Usuários ativos" />
          <Bar value={usage.contacts} max={plan.max_contacts} label="Contatos" />
          <Bar value={usage.messages_month} max={plan.max_messages_month} label="Mensagens (mês)" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {allPlans.map((p) => (
          <div key={p.code} className={`p-5 rounded-xl border ${p.code === plan.code ? "border-primary bg-primary/5" : "border-border/40 bg-card"}`}>
            <div className="font-semibold">{p.name}</div>
            <div className="text-2xl font-bold mt-2">{p.price_monthly > 0 ? `R$ ${p.price_monthly}` : "Grátis"}</div>
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2"><Check className="w-3 h-3 text-primary mt-0.5 shrink-0" /> {p.max_users >= 999 ? "Usuários ilimitados" : `${p.max_users} usuários`}</li>
              <li className="flex gap-2"><Check className="w-3 h-3 text-primary mt-0.5 shrink-0" /> {p.max_contacts >= 999999 ? "Contatos ilimitados" : `${p.max_contacts.toLocaleString("pt-BR")} contatos`}</li>
              <li className="flex gap-2"><Check className="w-3 h-3 text-primary mt-0.5 shrink-0" /> {p.max_messages_month >= 999999 ? "Mensagens ilimitadas" : `${p.max_messages_month.toLocaleString("pt-BR")} msg/mês`}</li>
            </ul>
            {p.code !== plan.code && (role === "owner" || role === "admin") && (
              <Button variant="outline" size="sm" className="w-full mt-4" disabled>
                {p.price_monthly > plan.price_monthly ? "Fazer upgrade" : "Trocar plano"}
              </Button>
            )}
            {p.code === plan.code && <div className="text-xs text-primary text-center mt-4 font-medium">Plano atual</div>}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">Para mudar de plano, fale com o time FCE.</p>
    </div>
  );
}

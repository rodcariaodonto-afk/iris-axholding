import { NavLink, Outlet } from "react-router-dom";
import { Building2, Users, Shield, Plug, Lock, Zap, Activity, ShieldCheck } from "lucide-react";
import { useActiveAccount } from "@/hooks/useActiveAccount";

const tabs = [
  { to: "/account/overview", label: "Visão geral", icon: Building2, roles: ["owner", "admin", "manager"] },
  { to: "/account/plan", label: "Plano e uso", icon: Zap, roles: ["owner", "admin"] },
  { to: "/account/users", label: "Usuários", icon: Users, roles: ["owner", "admin"] },
  { to: "/account/permissions", label: "Permissões", icon: Shield, roles: ["owner", "admin"] },
  { to: "/account/integrations", label: "Integrações", icon: Plug, roles: ["owner", "admin"] },
  { to: "/account/governance", label: "Governança", icon: ShieldCheck, roles: ["owner", "admin"] },
  { to: "/account/audit", label: "Auditoria", icon: Activity, roles: ["owner", "admin"] },
  { to: "/account/security", label: "Segurança", icon: Lock, roles: ["owner", "admin"] },
] as const;

export default function AccountLayout() {
  const { role, isSuperAdmin, memberships, activeAccountId } = useActiveAccount();
  const active = memberships.find((m) => m.account_id === activeAccountId);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 pt-8 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{active?.account.name || "Conta"}</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Gestão da conta</p>
          </div>
        </div>
        <nav className="flex gap-1 mt-6 overflow-x-auto">
          {tabs
            .filter((t) => isSuperAdmin || (role && (t.roles as readonly string[]).includes(role)))
            .map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`
                }
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </NavLink>
            ))}
        </nav>
      </header>
      <div className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </div>
    </div>
  );
}

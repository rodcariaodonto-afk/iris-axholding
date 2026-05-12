import { NavLink, Outlet } from "react-router-dom";
import { ShieldCheck, Download, Activity, Trash2, FileCheck, UserSearch, KeyRound, Settings2 } from "lucide-react";

const tabs = [
  { to: "/account/governance/overview", label: "Visão geral", icon: ShieldCheck },
  { to: "/account/governance/exports", label: "Exportações", icon: Download },
  { to: "/account/governance/audit", label: "Auditoria", icon: Activity },
  { to: "/account/governance/retention", label: "Retenção & Exclusão", icon: Trash2 },
  { to: "/account/governance/compliance", label: "Conformidade", icon: FileCheck },
  { to: "/account/governance/dsar", label: "Pedidos dos titulares", icon: UserSearch },
  { to: "/account/governance/consents", label: "Consentimentos", icon: KeyRound },
  { to: "/account/governance/policies", label: "Políticas", icon: Settings2 },
];

export default function GovernanceLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Governança de Dados</h2>
        <p className="text-sm text-muted-foreground">
          Controle, auditoria, exportação, retenção e conformidade da sua conta.
        </p>
      </div>
      <nav className="flex gap-1 overflow-x-auto pb-2 border-b border-border/40">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors whitespace-nowrap ${
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
      <Outlet />
    </div>
  );
}

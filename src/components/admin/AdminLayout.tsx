import { ReactNode } from "react";
import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Building2, Users, Activity, ShieldCheck, Loader2, FileCheck } from "lucide-react";

const TABS: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/admin/accounts", label: "Contas", icon: <Building2 className="w-4 h-4" /> },
  { to: "/admin/users", label: "Usuários", icon: <Users className="w-4 h-4" /> },
  { to: "/admin/audit", label: "Auditoria global", icon: <Activity className="w-4 h-4" /> },
  { to: "/admin/governance", label: "Governança", icon: <FileCheck className="w-4 h-4" /> },
];

export default function AdminLayout() {
  const { isSuperAdmin, loading } = useActiveAccount();
  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-border/40 bg-card/30 px-8 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">AXHolding · Super Admin</h1>
            <p className="text-xs text-muted-foreground">Visão interna de todas as contas</p>
          </div>
        </div>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors ${
                isActive ? "border-primary text-foreground bg-card" : "border-transparent text-muted-foreground hover:text-foreground"
              }`
            }>
              {t.icon}{t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="p-8"><Outlet /></div>
    </div>
  );
}

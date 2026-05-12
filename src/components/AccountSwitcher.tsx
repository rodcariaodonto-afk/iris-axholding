import { useActiveAccount } from "@/hooks/useActiveAccount";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/permissions";

export function AccountSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { memberships, activeAccountId, switchAccount, role, loading } = useActiveAccount();
  const active = memberships.find((m) => m.account_id === activeAccountId);

  if (loading || memberships.length === 0) return null;

  // Se só tem 1 conta e não é super-admin, mostra apenas chip estático
  if (memberships.length === 1) {
    if (collapsed) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border/40">
        <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{active?.account.name}</div>
          <div className="text-[10px] text-muted-foreground">{role ? ROLE_LABEL[role] : ""}</div>
        </div>
      </div>
    );
  }

  const handleSwitch = async (accountId: string) => {
    if (accountId === activeAccountId) return;
    await switchAccount(accountId);
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-3 py-2 h-auto bg-secondary/30 border border-border/40 hover:bg-secondary/60"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-semibold text-foreground truncate">{active?.account.name}</div>
                <div className="text-[10px] text-muted-foreground">{role ? ROLE_LABEL[role] : ""}</div>
              </div>
            )}
          </div>
          {!collapsed && <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Trocar de conta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.account_id}
            onClick={() => handleSwitch(m.account_id)}
            className="flex items-center gap-2"
          >
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.account.name}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABEL[m.role]}{m.account.is_internal ? " · Interna" : ""}</div>
            </div>
            {m.account_id === activeAccountId && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

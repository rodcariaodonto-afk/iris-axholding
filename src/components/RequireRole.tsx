import { ReactNode } from "react";
import { useActiveAccount, type AccountRole } from "@/hooks/useActiveAccount";

interface RequireRoleProps {
  roles: AccountRole[];
  fallback?: ReactNode;
  children: ReactNode;
  /** If true, super-admins always pass through. Default true. */
  superAdminBypass?: boolean;
}

/**
 * Esconde children se o usuário não tem um dos papéis listados na conta ativa.
 * Não é uma verificação de segurança — é apenas para UI. Segurança real fica em RLS / edge functions.
 */
export function RequireRole({ roles, fallback = null, children, superAdminBypass = true }: RequireRoleProps) {
  const { role, isSuperAdmin } = useActiveAccount();
  if (superAdminBypass && isSuperAdmin) return <>{children}</>;
  if (!role || !roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}

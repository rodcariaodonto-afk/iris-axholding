import type { AccountRole } from "@/hooks/useActiveAccount";

export const ROLE_LABEL: Record<AccountRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gestor",
  sdr: "SDR / Atendente",
  viewer: "Visualizador",
};

export const ROLE_DESCRIPTION: Record<AccountRole, string> = {
  owner: "Acesso total. Pode excluir a conta e transferir propriedade.",
  admin: "Gerencia usuários, integrações, IA e dados da conta.",
  manager: "Gerencia equipe, pipeline e configurações operacionais.",
  sdr: "Atende conversas, gerencia contatos e deals atribuídos.",
  viewer: "Apenas leitura de dashboards e relatórios.",
};

export const ALL_ROLES: AccountRole[] = ["owner", "admin", "manager", "sdr", "viewer"];

export function hasRole(role: AccountRole | null, allowed: AccountRole[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

export function canManageAccount(role: AccountRole | null) {
  return hasRole(role, ["owner", "admin"]);
}
export function canManageUsers(role: AccountRole | null) {
  return hasRole(role, ["owner", "admin"]);
}
export function canManageBilling(role: AccountRole | null) {
  return hasRole(role, ["owner"]);
}
export function canManageIntegrations(role: AccountRole | null) {
  return hasRole(role, ["owner", "admin"]);
}
export function canManagePipeline(role: AccountRole | null) {
  return hasRole(role, ["owner", "admin", "manager"]);
}
export function canEditDeals(role: AccountRole | null) {
  return hasRole(role, ["owner", "admin", "manager", "sdr"]);
}
export function canDeleteDeals(role: AccountRole | null) {
  return hasRole(role, ["owner", "admin", "manager"]);
}

// Permission matrix used in /account/permissions
export const PERMISSION_MATRIX: { area: string; perms: { label: string; roles: AccountRole[] }[] }[] = [
  {
    area: "Conta",
    perms: [
      { label: "Editar nome, logo e plano", roles: ["owner", "admin"] },
      { label: "Excluir conta", roles: ["owner"] },
      { label: "Trocar de papel próprio", roles: [] },
    ],
  },
  {
    area: "Usuários",
    perms: [
      { label: "Convidar e remover usuários", roles: ["owner", "admin"] },
      { label: "Alterar papéis", roles: ["owner", "admin"] },
    ],
  },
  {
    area: "Integrações",
    perms: [
      { label: "Configurar WhatsApp / Evolution", roles: ["owner", "admin"] },
      { label: "Conectar Google Calendar", roles: ["owner", "admin", "manager", "sdr"] },
    ],
  },
  {
    area: "IA / Nina",
    perms: [
      { label: "Editar prompt e personalidade", roles: ["owner", "admin"] },
      { label: "Ativar/Desativar IA", roles: ["owner", "admin", "manager"] },
    ],
  },
  {
    area: "Pipeline & Deals",
    perms: [
      { label: "Configurar pipeline e estágios", roles: ["owner", "admin", "manager"] },
      { label: "Criar/Editar deals", roles: ["owner", "admin", "manager", "sdr"] },
      { label: "Excluir deals", roles: ["owner", "admin", "manager"] },
    ],
  },
  {
    area: "Conversas",
    perms: [
      { label: "Atender conversas", roles: ["owner", "admin", "manager", "sdr"] },
      { label: "Visualizar relatórios", roles: ["owner", "admin", "manager", "viewer"] },
    ],
  },
];

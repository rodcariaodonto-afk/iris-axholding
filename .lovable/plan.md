# Fase 2 — Menu "Conta", Papéis Granulares, Convites e AccountSwitcher

Construir a camada de gestão de conta sobre a base multi-tenant da Fase 1, sem mexer em features existentes.

## Entregáveis

### 1. Hook & permissões
- `useAccountRole()` — retorna role do usuário na conta ativa (`owner | admin | manager | sdr | viewer`) + helpers (`isOwner`, `canManageUsers`, `canManageBilling`, `isSuperAdmin`).
- `<RequireRole roles={[...]}>` — wrapper para esconder UI por papel.

### 2. AccountSwitcher (header)
- Dropdown no topbar listando contas onde o user é membro.
- Troca chama `set_active_account` (RPC) + atualiza `localStorage` e força reload das queries.
- Aparece só se o user pertence a 2+ contas (ou é super-admin).

### 3. Sidebar — grupo "Conta"
Adicionar novo grupo no `AppSidebar` com 5 rotas:
- `/account/overview` — nome, plano, logo, slug, métricas básicas
- `/account/users` — lista de membros + convites pendentes (move funcionalidade atual de Team para cá, mas mantém Team como está)
- `/account/permissions` — matriz visual de permissões por papel (read-only nesta fase)
- `/account/integrations` — atalho para WhatsApp/Google Calendar/Evolution já existentes
- `/account/security` — sessões, change password, (placeholder para Fase 3 retention/export)

Visível apenas para `owner|admin`. `manager` vê só Overview e Users. `sdr|viewer` não vê o grupo.

### 4. Sistema de Convites
- Página pública `/invite/:token` — mostra dados do convite e CTA "Aceitar" (com signup ou login se já houver conta).
- Edge function `account-invite` (criar convite + enviar email via Resend usando template já existente).
- Edge function `account-invite-accept` (valida token, expira, cria/atualiza `account_members`).
- UI em `/account/users` para criar convite, listar pendentes, revogar, reenviar.

### 5. Refactor da criação direta de usuário
- `create-team-user` ganha validação de papel (apenas `owner|admin` da conta podem chamar).
- Quando o convidado aceita, papel é mapeado: admin↔admin, manager↔manager, atendente↔sdr.

### 6. Esconder ações sensíveis na UI
Auditar e gatear por papel:
- Botões "Adicionar usuário", "Editar prompt da IA", "Configurar WhatsApp", "Excluir deal", "Mudar pipeline" → admin/manager conforme caso.
- `sdr` só interage com conversas/contatos atribuídos.
- `viewer` só leitura.

## Detalhes técnicos

- **AccountSwitcher**: usa `useActiveAccount` (já existe). Ao trocar, executa `await supabase.rpc('set_active_account', { _account_id })` e `window.location.reload()` para garantir que TanStack Query/realtime reabram com o novo contexto.
- **Convites**: tabela `account_invites` já existe. Token é uuid v4 + base64. Email enviado via `send-invite-email` (já existe), apenas trocando o payload (`mode: 'account_invite'`, link `/invite/:token`).
- **`/invite/:token`**: rota pública (fora do AuthGuard). Se o user não está logado, faz login/signup; depois chama `account-invite-accept` que insere em `account_members` e seta o convite como `accepted_at`.
- **RLS**: já cobre — `account_invites` tem policy de owner/admin; `account_members` permite owner/admin gerenciar.
- **Edge functions novas**: `account-invite` (POST), `account-invite-accept` (POST). Ambas com `verify_jwt = false` no `config.toml` apenas para `account-invite-accept` (aceite pode ser feito por usuário recém-criado). `account-invite` valida JWT e papel via `is_account_member` + `has_account_role`.

## Não está nesta fase
- Planos comerciais, billing, limites
- Audit logs
- Super-admin AXHolding (área especial)
- Export/retention pós-cancelamento

→ Tudo isso fica para Fase 3.

## Riscos
- Baixo. Toda Fase 2 é aditiva. Não mexe em RLS existente nem em fluxos de mensagem/IA/calendário.
- Único cuidado: AccountSwitcher precisa fazer `reload()` para evitar caches de queries com `account_id` antigo.

Confirma para eu começar a implementação?

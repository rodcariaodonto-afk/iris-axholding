
# Plano: IRIS Multi-Tenant SaaS B2B

Transformação faseada em 3 etapas. Cada fase é deployável e não quebra o que já existe — a Fase 1 cria a base sem ainda exigir mudança no comportamento do usuário, e cada fase seguinte adiciona camadas.

---

## Fase 1 — Fundação multi-tenant + migração de dados

**Objetivo:** todo dado passa a pertencer a uma `account`, mas a operação atual continua funcionando exatamente igual (todos os dados existentes vão para a conta `AXHolding`).

### Banco de dados

Novas tabelas:
- `accounts` — `id`, `name`, `slug` único, `domain`, `status` (active/suspended/cancelled), `plan` (starter/pro/business/enterprise — enum), `is_internal` (bool, marca a "AXHolding Internal"), `subscription_data` jsonb, `limits` jsonb, `settings` jsonb, `created_at`, `updated_at`, `cancelled_at`, `delete_after`.
- `account_members` — `id`, `account_id`, `user_id`, `role` (enum: owner/admin/manager/sdr/viewer), `status` (invited/active/disabled), `permissions` jsonb, `invited_by`, `invited_at`, `joined_at`, `last_active_at`.
- `account_invites` — `id`, `account_id`, `email`, `role`, `token`, `expires_at`, `accepted_at`, `invited_by`.

Adicionar `account_id uuid` (nullable inicialmente, depois NOT NULL) em todas as tabelas operacionais:
- `contacts`, `conversations`, `messages`, `appointments`, `deals`, `pipeline_stages`, `teams`, `team_members`, `team_functions`, `tag_definitions`, `media_library`, `nina_settings`, `google_calendar_connections`, `conversation_states`, `send_queue`, `nina_processing_queue`, `message_processing_queue`, `message_grouping_queue`.

Migração de dados (idempotente):
1. Criar conta `AXHolding Internal` (`is_internal=true`, `plan=enterprise`).
2. Inserir todos os usuários atuais como `account_members` dessa conta com role `owner` (Rodrigo) e `admin` para os demais que hoje têm `user_roles.admin`; `sdr` para os demais.
3. `UPDATE` em todas as tabelas operacionais setando `account_id` para o id da AXHolding.
4. `ALTER TABLE ... ALTER COLUMN account_id SET NOT NULL` depois da migração.

Funções security-definer:
- `current_account_id()` — retorna a account ativa do request (lida de header/JWT claim ou da única account do usuário).
- `is_account_member(_account_id uuid)` — bool.
- `account_role(_account_id uuid)` — retorna o role.
- `has_account_role(_account_id uuid, _roles app_account_role[])` — bool.
- `is_super_admin()` — membro ativo da conta `is_internal=true` com role owner/admin.

RLS (substituir as policies `auth.role() = 'authenticated'` atuais):
- Policy padrão por tabela: `account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid() AND status='active')` ou `is_super_admin()`.
- INSERT/UPDATE/DELETE adicionalmente checam role mínimo (ex.: viewer não pode INSERT).
- `accounts`: SELECT só onde for membro ou super-admin; UPDATE só owner/admin; INSERT só super-admin (ou via edge function de signup).
- `account_members`: SELECT membros da mesma conta; mutate apenas owner/admin da conta + super-admin.

Trigger `handle_new_user` atualizada: não cria mais role automaticamente; criação de membership acontece via convite ou signup de nova conta.

### Frontend (mínimo na Fase 1)

- Hook `useActiveAccount()` que: busca memberships do usuário, define account ativa (única → auto; múltiplas → seleciona via localStorage + fallback primeira), expõe `accountId`, `role`, `accounts[]`.
- Wrapper Supabase que injeta header `x-account-id` em todas as queries (lido por `current_account_id()` via `current_setting`/JWT claim através de função SQL helper).
- Como toda conta atual aponta pra AXHolding, **nada muda visualmente** para o Rodrigo nesta fase.

### Edge Functions

Criar helper `_shared/auth.ts` reutilizável: `requireUser()`, `requireAccountMember(accountId)`, `requireRole(accountId, roles[])`. Aplicar nas funções sensíveis (whatsapp-sender, nina-orchestrator, google-calendar-*, create-team-user, generate-prompt etc.) sem trocar a lógica.

---

## Fase 2 — Menu Conta, papéis, convites, seletor

**Objetivo:** colocar a UI B2B no ar.

### UI

Novo grupo no sidebar **"Conta"** com subáreas:
- `/account/overview` — dados da empresa (nome, slug, domínio, logo).
- `/account/users` — lista de membros, status, role, "Convidar usuário", editar role, desativar.
- `/account/permissions` — matriz de permissões por role (somente leitura na Fase 2).
- `/account/integrations` — agrupa as integrações que hoje estão espalhadas (WhatsApp, Google Calendar, ElevenLabs).
- `/account/security` — sessões, último login, MFA placeholder.

Componente `AccountSwitcher` no header (só renderiza se o usuário tem >1 account — útil para super-admins).

Página `/invite/:token` para aceitar convite (cria user se não existir, vincula como membro).

### Convites

Edge function `account-invite`:
- Cria registro em `account_invites`, gera token, envia e-mail via Resend (template já existe parcialmente em `invite-team-user`).
- Valida que quem chama é owner/admin da conta.

Edge function `account-invite-accept`:
- Valida token, cria membership ativo, marca convite aceito.

Refatorar `create-team-user`/`invite-team-user` para usar o novo fluxo, mantendo backwards-compat com os usuários já existentes.

### Permissões aplicadas

UI esconde botões/menus conforme `role` do `useActiveAccount`. **Mas** o controle real continua no banco/edge (RLS já filtra). Matriz:
- **Owner:** tudo + faturamento + apagar conta.
- **Admin:** tudo exceto faturamento e apagar conta.
- **Gestor:** lê tudo, edita pipeline/configurações operacionais, não mexe em integrações nem usuários.
- **SDR:** opera contatos/conversas/deals/agendamentos próprios e da equipe; não mexe em configs.
- **Viewer:** só leitura em relatórios e listas.

---

## Fase 3 — Planos, auditoria, super-admin AXHolding, governança

### Planos & limites

Tabela `plans` com `code`, `name`, `monthly_price`, `limits` jsonb (max_users, max_contacts, max_messages_month, max_ai_agents, integrations[], features[]).
Função `check_account_limit(account_id, limit_key)` chamada pelas edge functions sensíveis (envio de mensagem, criação de usuário, etc.). Bloqueia com erro estruturado quando excedido.
Tela `/account/billing` mostra plano atual, uso vs. limite, CTA upgrade (sem cobrança ativa ainda — gancho preparado pra Stripe).

### Auditoria

Tabela `audit_logs`: `id`, `account_id`, `user_id`, `action` (text — ex.: `member.invited`, `lead.deleted`, `integration.updated`), `entity_type`, `entity_id`, `metadata` jsonb, `ip`, `user_agent`, `created_at`.
Função `log_audit(...)` security-definer. Chamada em:
- Login bem-sucedido (via edge function ou trigger no auth schema → não, melhor edge `auth-event`).
- Mudança de role/membership.
- Convites enviados/aceitos/revogados.
- Edição/exclusão de leads, deals, configs.
- Alterações em integrações (WhatsApp/Google/ElevenLabs).
- Exportação de dados.
Tela `/account/audit` lista logs filtráveis para owner/admin.

### Super-admin AXHolding

Sidebar mostra grupo extra **"AXHolding Admin"** apenas se `is_super_admin()`:
- `/admin/accounts` — todas as contas, status, plano, MRR placeholder, usuários, último uso.
- `/admin/accounts/:id` — drill-down: membros, integrações, logs de auditoria, ações (suspender, mudar plano, apagar).
- `/admin/health` — saúde geral (filas, edge function logs).
- `/admin/security` — findings do scanner Supabase.

Edge function `admin-impersonate` (opcional, gera token temporário para ver conta como owner para suporte; loga no audit_logs).

### Governança

- Botão "Exportar dados" em `/account/security` → edge function `account-export` empacota JSON (contacts, conversations, messages, deals, appointments) e devolve URL assinada por 24h. Limite de tamanho — exclui mídias.
- Cancelamento de conta: marca `status='cancelled'`, `cancelled_at=now()`, `delete_after=now()+30d`. Edge function agendada (cron) apaga depois de 30 dias.
- Termos & retenção exibidos em `/account/security`.

---

## Detalhes técnicos

**Como `current_account_id()` resolve a conta ativa:**
1. Frontend define `localStorage.activeAccountId` via AccountSwitcher.
2. Wrapper supabase chama `supabase.rpc('set_active_account', { account_id })` no início da sessão (seta variável de sessão Postgres).
3. Função `current_account_id()` lê `current_setting('app.active_account', true)` e cai no fallback "primeira account ativa do usuário".
4. RLS sempre cruza com `account_members` para garantir que o usuário não pode forjar account_id no header.

**Risco zero de regressão na Fase 1:**
- Todo dado migra para AXHolding antes de NOT NULL.
- Como o Rodrigo é membro com role owner, RLS permite ver tudo igual antes.
- Edge functions ganham validação extra mas mantêm comportamento.

**O que NÃO muda:**
- Visual, fluxos atuais de WhatsApp/Nina/Iris, agendamento, pipeline, Google Calendar (que acabamos de conectar).
- Tabela `user_roles` continua existindo para compat (depreca na Fase 3).
- `nina_settings` ganha `account_id` — cada conta passa a ter suas próprias configs de IA.

**Memória:**
- Atualizar `mem://architecture/tenancy-model` ao final da Fase 1 ("multi-tenant com isolamento por account_id").
- Remover entrada Core "Single-tenant architecture".

---

## Entregáveis por fase

| Fase | Migrations | Edge fns | Páginas novas | Risco |
|---|---|---|---|---|
| 1 | accounts, account_members, account_id em ~18 tabelas, RLS rewrite, helpers | helper _shared/auth + retrofit | nenhuma (transparente) | Médio (RLS) |
| 2 | account_invites | account-invite, account-invite-accept, account-update | /account/* (5), /invite/:token, AccountSwitcher | Baixo |
| 3 | plans, audit_logs, retention | account-export, admin-*, log_audit, cron-cleanup | /admin/*, /account/billing, /account/audit | Baixo |

Quer que eu comece pela **Fase 1**? Recomendo aprovar fase a fase para você poder validar antes de ir adiante.

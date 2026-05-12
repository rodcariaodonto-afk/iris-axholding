## Fase 3 — Planos, Auditoria, Super-Admin AXHolding e Retenção

Última camada do modelo multi-tenant. Tudo aditivo, sem mexer em features das Fases 1 e 2.

### 1. Planos & Limites
- Tabela `account_plans` (catálogo: starter, pro, business, enterprise) com limites: `max_users`, `max_contacts`, `max_messages_month`, `max_whatsapp_numbers`, `ai_responses_month`, `features` jsonb.
- Função `check_account_limit(_account_id, _resource)` usada em edge functions (criar contato, enviar mensagem, criar usuário) — retorna erro amigável quando estoura.
- Página `/account/plan` — mostra plano atual, uso vs limite (barras), CTA "Falar com vendas" (sem billing real nesta fase, só estrutura).
- Campo `accounts.plan` já existe; vamos popular limites por padrão via trigger.

### 2. Audit Logs
- Tabela `audit_logs` (`account_id`, `actor_user_id`, `action`, `resource_type`, `resource_id`, `metadata`, `ip`, `created_at`).
- RLS: leitura para `owner|admin`; insert via service_role (edge functions e triggers).
- Triggers em: `account_members` (invite/remove/role change), `accounts` (update), `nina_settings` (mudanças críticas), `pipeline_stages` (delete).
- Página `/account/audit` — timeline filtrável por ator, ação e período.

### 3. Super-Admin AXHolding (área interna)
- Conta `AXHolding Internal` (`is_internal=true`) já criada na Fase 1.
- Novo grupo no Sidebar **"AXHolding"** visível só para `isSuperAdmin`:
  - `/admin/accounts` — lista todas as contas, status, plano, MRR fictício, último acesso, ações (suspender, reativar, impersonar).
  - `/admin/users` — busca global de usuários cross-account.
  - `/admin/health` — saúde do sistema (filas, edge functions, erros recentes).
  - `/admin/audit` — audit logs globais (todas as contas).
- Edge function `admin-impersonate` (apenas super-admin) — gera token temporário para entrar em uma conta como viewer (ações ficam logadas com flag `impersonated_by`).

### 4. Retenção, Export e Soft-Delete
- Campos `accounts.cancelled_at` e `accounts.delete_after` já existem.
- Edge function `account-export` — gera ZIP com JSON de contatos, conversas, mensagens, deals, appointments. Resultado em storage privado, link assinado por 24h.
- Edge function `account-cancel` — marca `cancelled_at=now()`, `delete_after=now()+30d`, suspende membros (status=suspended), bloqueia novas mensagens.
- Cron diário `account-purge` — apaga contas onde `delete_after < now()`.
- Página `/account/security` ganha botões reais: "Exportar dados", "Cancelar conta" (com confirmação dupla).

### 5. Refinos finais
- Aplicar gating por papel nos botões pendentes da UI: criar deal (sdr+), excluir deal (manager+), editar prompt IA (admin+), configurar WhatsApp (admin+), pipeline (manager+).
- Esconder grupo "Conta" para sdr/viewer no Sidebar (já parcialmente feito, completar).
- Mostrar badge do plano atual no header ao lado do AccountSwitcher.

### Detalhes técnicos
- Migration única com: `account_plans`, `audit_logs`, função `check_account_limit`, função `log_audit`, triggers em tabelas críticas, seed dos 4 planos padrão.
- Edge functions novas: `admin-impersonate`, `account-export`, `account-cancel`, `account-purge` (cron). Todas com validação de papel via `has_account_role` ou `is_super_admin`.
- Storage bucket privado novo: `account-exports` (RLS: owner/admin do account_id no path).
- Hook novo `useAccountUsage()` para alimentar a página `/account/plan`.

### Não inclui
- Billing real (Stripe/Paddle) — fica para Fase 4 quando comercial estiver definido.
- Onboarding self-service de novas contas (criar conta a partir do signup público) — fica como decisão futura.

### Riscos
- Médio. Triggers de audit podem virar gargalo em volume alto → escrita assíncrona via fila se necessário.
- Soft-delete precisa garantir que webhooks da Evolution/Meta não criem contatos em contas suspensas (adicionar check em `whatsapp-webhook`).

Confirma para eu começar a implementação?
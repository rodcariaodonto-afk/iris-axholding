## Objetivo

Permitir que o Super Admin **suspenda** (bloqueia acesso + pausa IA) ou **exclua** (soft delete com 30 dias para reverter) qualquer conta cliente diretamente da tela `Admin → Contas`.

## Escopo

### 1. UI — `AdminAccounts.tsx`
Adicionar menu de ações (`⋯`) em cada linha da lista de contas com 3 opções dinâmicas conforme o status atual:

- **Conta `active`** → "Suspender conta" + "Excluir conta"
- **Conta `suspended`** → "Reativar conta" + "Excluir conta"
- **Conta `cancelled` (com exclusão agendada)** → "Cancelar exclusão" + badge mostrando dias restantes

Proteções:
- Conta `is_internal: true` (AXHolding) não mostra ações destrutivas — não pode ser suspensa nem excluída
- Diálogo de confirmação obrigatório em todas as ações
- Para excluir: campo de motivo opcional + checkbox "Entendo que após 30 dias a exclusão é permanente"

### 2. Edge function — `super-admin-account-action`
Nova função única que centraliza as 4 operações (suspend / reactivate / delete / cancel-deletion):

- Valida JWT + super admin (mesma lógica do `super-admin-create-client`)
- Bloqueia ações em contas internas
- Registra tudo em `audit_logs` com `severity: warn|critical`

**Suspender (`suspend`):**
- `accounts.status = 'suspended'`
- `nina_settings.is_active = false` (pausa IA — não responde novas mensagens)
- `nina_settings.auto_response_enabled = false`

**Reativar (`reactivate`):**
- `accounts.status = 'active'`
- `nina_settings.is_active = true`
- `nina_settings.auto_response_enabled = true`

**Excluir (soft delete, `delete`):**
- `accounts.status = 'cancelled'`
- `accounts.deletion_status = 'scheduled'`
- `accounts.deletion_scheduled_at = now()`
- `accounts.delete_after = now() + 30 days`
- `accounts.deletion_reason = motivo`
- `accounts.cancelled_at = now()`
- Pausa IA também (igual suspend)

**Cancelar exclusão (`cancel_deletion`):**
- Reverte campos de exclusão para NULL
- `status = 'active'`, reativa IA

### 3. Efeito do bloqueio no login do cliente
Atualizar `useAuth.tsx` (ou criar guard no `ProtectedRoute`) para, após o login, checar se alguma `account_member` ativa do usuário pertence a uma conta com `status != 'active'`. Se TODAS estiverem suspensas/canceladas:
- Faz `signOut` automático
- Mostra toast: "Sua conta está suspensa. Entre em contato com o suporte."

### 4. Indicador visual na lista
- Badge `status` já existe (active/suspended/cancelled) — manter
- Para contas `cancelled`: mostrar "Exclusão em X dias" em vermelho ao lado do badge

## Detalhes técnicos

**Arquivos novos:**
- `supabase/functions/super-admin-account-action/index.ts`

**Arquivos modificados:**
- `src/components/admin/AdminAccounts.tsx` — menu de ações + diálogos
- `src/hooks/useAuth.tsx` — verificação de status pós-login (ou novo hook `useAccountStatusGuard`)

**Não precisa migration de schema** — todos os campos necessários já existem em `accounts` (`status`, `deletion_status`, `deletion_scheduled_at`, `delete_after`, `deletion_reason`, `cancelled_at`).

**Fluxo de purge real após 30 dias:** já existe `account-purge` edge function. Fica como melhoria futura agendar via cron — por enquanto pode ser disparado manualmente quando necessário.

## Fora do escopo

- Cron automático para purge definitivo (fica para depois)
- Notificação por email ao cliente sobre suspensão/exclusão
- Histórico visual de todas as ações na linha da conta (já fica em `audit_logs`, basta consultar se necessário)

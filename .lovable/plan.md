
# Fase B + WhatsApp por usuário, com transferência (modelo Axis)

Replicar exatamente o fluxo do Axis Operations Hub: cada membro da equipe conecta o próprio número de WhatsApp, mensagens entram na caixa do dono daquele número, e qualquer atendente pode transferir a conversa para outro usuário ou para uma fila (SDR → Closer, por exemplo).

## 1. Mudanças de schema

### `whatsapp_sessions` — sessão pertence a um usuário
- Adicionar `owner_user_id uuid` (FK lógica → `auth.users`)
- Backfill: sessões existentes ficam com o owner = primeiro `owner/admin` da conta
- RLS continua por `account_id`, mas leitura/edição de credenciais limita a `owner_user_id = auth.uid()` OR `owner/admin`

### Roteamento de mensagens (Fase B)
Adicionar `session_id uuid` em:
- `conversations`
- `messages`
- `send_queue`
- `nina_processing_queue`
- `message_processing_queue`
- `message_grouping_queue`

Backfill: tudo aponta para a sessão `is_default = true` da conta.

### Atribuição da conversa
`conversations.assigned_user_id` já existe. Regras:
- Webhook recebe mensagem → identifica `session_id` pelo `phone_number_id` (Meta) ou `instance_name` (Evolution)
- Se conversa é nova: `assigned_user_id = whatsapp_sessions.owner_user_id`
- Se conversa já existe: mantém o `assigned_user_id` atual

### Filas de atendimento
- `whatsapp_queues` (id, account_id, name, description) — ex: "SDR", "Closer", "Suporte"
- `whatsapp_queue_members` (queue_id, user_id, account_id) — quem participa de cada fila
- RLS: membros da conta leem; `owner/admin/manager` editam

### Auditoria de transferência
- `whatsapp_transfer_logs` (account_id, conversation_id, contact_id, from_user_id, to_user_id, to_queue_id, reason, transferred_by, created_at)
- Append-only, RLS por `account_id`

## 2. Edge Functions

### Atualizadas (Fase B routing)
- **`whatsapp-webhook`** — resolve `session_id` pelo identificador do provider; grava `session_id` em conversation/message; se conversa nova, define `assigned_user_id = session.owner_user_id`. Fallback para sessão default se não resolver.
- **`whatsapp-sender`** — lê `session_id` da `send_queue`/conversation, busca credenciais da `whatsapp_sessions` correspondente (não mais do `nina_settings`).
- **`nina-orchestrator`** — propaga `session_id` ao enfileirar resposta.

### Novas
- **`whatsapp-transfer-conversation`** — body: `{ conversation_id, to_user_id?, to_queue_id?, reason? }`
  - Valida que o caller é membro da conta
  - Se `to_queue_id`: escolhe um membro da fila (round-robin simples ou aleatório, como no Axis)
  - Atualiza `conversations.assigned_user_id`
  - Insere em `whatsapp_transfer_logs`
  - Audita em `audit_logs`

## 3. Frontend

### Settings → WhatsApp
- Cada usuário vê **apenas a sua sessão** (e cria a sua)
- `owner/admin` veem todas as sessões da conta (somente leitura nas alheias)
- Server settings (URL/key Evolution) continuam compartilhados por conta

### Settings → Filas (nova aba)
- CRUD de filas (`owner/admin/manager`)
- Adicionar/remover membros por fila

### Chat
- Lista de conversas filtrada por `assigned_user_id = auth.uid()` por padrão (toggle "Todas" para `owner/admin/manager`)
- Badge mostrando o número que recebeu a conversa
- Botão **"Transferir"** no header da conversa:
  - Modal com tabs **Usuário** | **Fila**
  - Tab Usuário: lista membros da conta com a sessão WhatsApp deles
  - Tab Fila: lista filas disponíveis
  - Campo opcional "Motivo"
  - Confirma → chama `whatsapp-transfer-conversation`
- Histórico de transferências (timeline na sidebar do contato)

## 4. Permissões

| Ação | sdr | closer | manager | admin/owner |
|------|-----|--------|---------|-------------|
| Criar/conectar própria sessão | ✓ | ✓ | ✓ | ✓ |
| Ver sessão de outros | — | — | ✓ | ✓ |
| Editar Evolution server settings | — | — | — | ✓ |
| Ver conversas próprias | ✓ | ✓ | ✓ | ✓ |
| Ver todas conversas da conta | — | — | ✓ | ✓ |
| Transferir conversa própria | ✓ | ✓ | ✓ | ✓ |
| Transferir conversa de outros | — | — | ✓ | ✓ |
| Gerenciar filas | — | — | ✓ | ✓ |

## 5. Limites de plano
- `account_plans.max_whatsapp_numbers` continua aplicado, mas agora representa **número total de sessões na conta** (= número de usuários conectados simultaneamente).

## 6. Migração / Backfill (sem downtime)
1. Aplicar schema (colunas novas nullable + tabelas novas)
2. Backfill `session_id` em todas as filas/conversas/mensagens → sessão default
3. Backfill `owner_user_id` da sessão default → primeiro owner da conta
4. Deploy edge functions atualizadas (mantém fallback para default se `session_id` faltar)
5. Frontend novo
6. Após validação em produção: tornar `session_id` NOT NULL nas tabelas críticas

## 7. Realtime
Adicionar à publication: `whatsapp_transfer_logs`, `whatsapp_queues`, `whatsapp_queue_members`. (`whatsapp_sessions` já está.)

## 8. Fora de escopo
- Atribuição automática round-robin avançada (peso, online/offline) — fica como evolução
- Notificação push ao usuário que recebeu transferência — pode entrar em iteração seguinte

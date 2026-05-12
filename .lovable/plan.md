## Objetivo

Permitir que cada Conta conecte **vários números de WhatsApp** simultaneamente (Evolution API e/ou Meta Cloud), gerenciados em uma aba dedicada — exatamente como funciona no projeto Axis Operations Hub, mas adaptado à estrutura multi-tenant da IRIS (`account_id`) e às permissões já existentes (`owner/admin/manager`).

## Situação atual (IRIS)

- WhatsApp é configurado em **`nina_settings`** (1 linha por conta), com colunas inline:
  - Evolution: `evolution_api_url`, `evolution_api_key`, `evolution_instance_name`
  - Meta Cloud: `whatsapp_access_token`, `whatsapp_phone_number_id`, `whatsapp_business_account_id`, `whatsapp_verify_token`
- Conclusão: **só dá para 1 número por Conta**. As Edge Functions (`whatsapp-webhook`, `whatsapp-sender`, `nina-orchestrator`) leem essa única configuração.

## Modelo proposto (inspirado no Axis)

### Novas tabelas

1. **`whatsapp_sessions`** — uma linha por número conectado
   - `account_id`, `provider` (`evolution` | `meta_cloud`), `session_name` (label), `status` (`disconnected | qr_pending | connecting | connected | error`), `phone_number`, `qr_code`, `last_connected_at`, `error_message`
   - Evolution: `evolution_instance_name`, `evolution_instance_id`
   - Meta Cloud: `whatsapp_phone_number_id`, `whatsapp_business_account_id`, `whatsapp_access_token`, `whatsapp_verify_token`
   - `is_default` (boolean) — sessão usada por padrão para envio quando não há roteamento explícito
   - RLS por `account_id` + `has_account_role(account_id, ['owner','admin','manager'])` para escrita

2. **`whatsapp_account_settings`** — configurações compartilhadas por Conta
   - `account_id` (unique), `evolution_api_url`, `evolution_api_key` (servidor Evolution comum), `max_sessions` (default 3, controlado pelo plano), `auto_reply_enabled`, `auto_reply_message`
   - Migração: copiar `nina_settings.evolution_api_url/key` existentes para esta tabela

### Vínculo com mensagens / contatos

- Adicionar `session_id uuid REFERENCES whatsapp_sessions(id)` em:
  - `conversations` (qual número recebeu o lead)
  - `messages` (qual número enviou/recebeu cada mensagem)
- Backfill: associar registros existentes à sessão default (criada a partir da config atual de `nina_settings`).

### Limites por plano

Estender `check_account_limit(_account_id, 'whatsapp_numbers')` usando `account_plans.max_whatsapp_numbers` (já existe no schema).

## Edge Functions

- **`whatsapp-webhook`**: identificar `session_id` pela URL (`/whatsapp-webhook/:sessionId`) ou pelo `phone_number_id` recebido no payload Meta / `instance` no payload Evolution. Carregar credenciais da `whatsapp_sessions` correspondente em vez de `nina_settings`.
- **`whatsapp-sender`**: aceitar `session_id` no payload (ou usar a default da Conta). Buscar credenciais da sessão.
- **`nina-orchestrator`** e enfileiramento: propagar `session_id` da conversa quando enfileirar resposta.
- **Novas funções**:
  - `whatsapp-session-create` — cria sessão (Evolution: cria instância via API + retorna QR; Meta: valida token)
  - `whatsapp-session-connect` — gera/atualiza QR e faz polling de status (Evolution)
  - `whatsapp-session-delete` — desconecta e remove instância no servidor Evolution
  - `whatsapp-session-status` — consulta status atual

Todas com `verify_jwt = true` exceto o webhook (mantém `false`), validação de membership + role `owner/admin/manager`.

## Frontend

### Nova aba `Settings → WhatsApp` (multi-sessão)

Layout em duas colunas (estilo Axis):

```text
┌─────────────────────────┬──────────────────────────────┐
│ Sessões (lista)         │ Detalhes da sessão           │
│ ┌──────────────────┐    │ - Nome / telefone / status   │
│ │ 📱 Vendas (✓)    │    │ - QR Code (Evolution)        │
│ │ 📱 Suporte (QR)  │    │ - Credenciais Meta           │
│ │ 📱 Marketing(✗)  │    │ - Marcar como padrão         │
│ │ + Nova sessão    │    │ - Reconectar / Excluir       │
│ └──────────────────┘    │                              │
│ Servidor Evolution      │ Webhook URL (copiar)         │
│ (URL + API key global)  │                              │
└─────────────────────────┴──────────────────────────────┘
```

Componentes (espelhando os do Axis, mas usando nossos design tokens):
- `WhatsAppSessionList.tsx` — lista com badges de status
- `WhatsAppSessionDetail.tsx` — painel direito
- `WhatsAppQRDialog.tsx` — modal com QR + auto-refresh
- `MetaConnectionDialog.tsx` — formulário Meta Cloud (já existe parcialmente em `StepWhatsApp`)
- `WhatsAppServerSettings.tsx` — URL/key Evolution compartilhada

Botão "Nova sessão" abre escolha entre Evolution / Meta Cloud, depois reaproveita o fluxo de `StepWhatsApp`.

### Onboarding

`StepWhatsApp` continua criando **a primeira sessão** (em vez de gravar em `nina_settings`). Contas existentes recebem a sessão automaticamente via migration de backfill.

### Seleção de sessão em outras telas

- ChatInterface / Conversations: badge mostrando por qual número a conversa entrou
- CreateDealModal / envio manual: dropdown opcional "Enviar de" (default = sessão padrão)

## Permissões

- Visualizar sessões: qualquer membro ativo da Conta
- Criar/editar/excluir/conectar: `owner`, `admin`, `manager` (via `RequireRole`)

## Migração

1. Criar tabelas + RLS + triggers `updated_at` + audit triggers
2. Backfill: para cada `nina_settings` com Evolution ou Meta configurado → criar 1 `whatsapp_sessions` com `is_default = true` + 1 `whatsapp_account_settings`
3. Backfill `conversations.session_id` e `messages.session_id` apontando para a sessão default
4. Manter colunas antigas em `nina_settings` por 1 release (deprecated) para rollback seguro

## Entrega faseada sugerida

- **Fase A (este card)**: schema + backfill + UI de gerenciamento + Edge Functions de sessão. Webhook e sender continuam usando a sessão default.
- **Fase B**: roteamento real por sessão no webhook/sender + seleção de sessão no chat e nas campanhas.

## Confirmação necessária

Quer que eu já implemente a **Fase A completa** (DB + UI + edge functions de gestão), mantendo o webhook/sender atuais usando a sessão padrão? Ou prefere que eu inclua já o roteamento multi-número (Fase A + B) num único bloco maior?

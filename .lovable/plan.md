

# Implementação da Integração com Google Calendar

## Resumo
O usuário criou com sucesso as credenciais OAuth no Google Cloud Console. Agora vamos implementar a integração completa: armazenar os secrets, criar a tabela de conexões, as Edge Functions de OAuth e sync, e o UI para conectar/desconectar.

## Etapas

### 1. Armazenar Secrets (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET)
- Usar a ferramenta `add_secret` para solicitar ao usuário que cole o **Client ID** e o **Client Secret** mostrados na screenshot.

### 2. Criar tabela `google_calendar_connections`
Migração SQL:
- `id`, `user_id` (referencia profiles), `access_token`, `refresh_token`, `token_expires_at`, `calendar_id` (default 'primary'), `is_active`, `created_at`, `updated_at`
- RLS: usuários só acessam suas próprias conexões
- Habilitar RLS

### 3. Edge Functions

**`google-calendar-auth`** — Gera a URL de autorização OAuth do Google e redireciona o usuário:
- Usa `GOOGLE_CLIENT_ID` e monta URL com redirect para callback
- Escopos: `calendar` e `calendar.events`
- Inclui `state` com o user_id para segurança

**`google-calendar-callback`** — Recebe o código do Google OAuth:
- Troca código por access_token + refresh_token
- Salva tokens na tabela `google_calendar_connections`
- Redireciona de volta para o app (`/settings` ou `/scheduling`)

**`google-calendar-sync`** — Sincroniza agendamentos:
- Recebe appointment_id e ação (create/update/delete)
- Usa access_token (com refresh automático se expirado) para chamar Google Calendar API
- Cria/atualiza/deleta evento no Google Calendar
- Salva `google_event_id` nos metadados do appointment

### 4. Adicionar coluna nos appointments
- Migração: adicionar campo `google_event_id text` na tabela `appointments` (para tracking do evento sincronizado)

### 5. Frontend

**Página de Configurações (ou Agendamentos):**
- Botão "Conectar Google Agenda" que chama a edge function `google-calendar-auth`
- Status de conexão (conectado/desconectado)
- Botão "Desconectar"

**Scheduling.tsx:**
- Ao criar/editar/deletar appointment, chamar `google-calendar-sync` automaticamente se o usuário tiver conexão ativa
- Ícone indicador nos appointments sincronizados com Google

### Detalhes Técnicos
- Tokens OAuth são armazenados no banco (não encriptados nesta fase, mas protegidos por RLS)
- Refresh automático do access_token quando expirado (validade ~1h)
- A URI de redirect já configurada: `https://ggrgqvnmuptwinxsobkz.supabase.co/functions/v1/google-calendar-callback`


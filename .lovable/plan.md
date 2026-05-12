## Objetivo

Replicar o fluxo de conexão Google Calendar do projeto **Axis Operations Hub** na Iris e adicionar geração automática de **links do Google Meet** ao criar eventos.

## Diagnóstico do problema atual

Hoje a Iris usa um padrão diferente do Axis:
- Existe uma função separada `google-calendar-callback` cujo `redirect_uri` aponta para `${SUPABASE_URL}/functions/v1/google-calendar-callback`. Esse URI precisa estar registrado no Google Cloud Console como Authorized Redirect URI — se não estiver, a conexão falha silenciosamente (é o sintoma "não conecta").
- Não há geração de Google Meet (`conferenceData`) ao criar eventos.

O Axis usa um fluxo mais simples: **uma única função** `google-calendar-auth` com `action=authorize|callback`, e o `redirect_uri` é a própria página da agenda no app (`${window.location.origin}/scheduling`). A página recebe `?code=...&state=...` e dispara um POST de callback para a Edge Function.

## Mudanças

### 1. Reescrever `supabase/functions/google-calendar-auth/index.ts`
Mesmo padrão do Axis:
- `GET ?action=authorize&redirect_uri=...` → retorna `{ url }` para o consent screen do Google.
- `POST ?action=callback` (body `{ code, state, redirect_uri }`) → troca o code por tokens e faz `upsert` em `google_calendar_connections` (campos `access_token`, `refresh_token`, `token_expires_at`, `is_active=true`).
- Embute `user_id` no `state` (base64).

### 2. Remover `supabase/functions/google-calendar-callback/`
Substituída pelo handler `action=callback` acima.

### 3. Atualizar `supabase/functions/google-calendar-sync/index.ts`
- Manter ações `create | update | delete` que já existem.
- Acrescentar **action `status`** (GET) — usado para checar conexão (igual Axis).
- No `create`/`update`, **adicionar Google Meet automaticamente** quando `appointment.type === 'meeting'` ou `appointment.create_meet === true`:
  ```
  conferenceData: {
    createRequest: {
      requestId: crypto.randomUUID(),
      conferenceSolutionKey: { type: 'hangoutsMeet' }
    }
  }
  ```
  e enviar com query string `?conferenceDataVersion=1`. Persistir `result.hangoutLink` em `appointments.meeting_url` (já existe no schema).
- Manter o refresh automático de access token que já está implementado.

### 4. Atualizar `src/hooks/useGoogleCalendar.ts`
- `connect()`: chamar `google-calendar-auth?action=authorize&redirect_uri=${origin}/scheduling` e redirecionar via `window.location.href = data.url`.
- Adicionar `handleOAuthCallback(code, state)` que faz POST para `google-calendar-auth?action=callback` e marca `isConnected=true`.

### 5. Atualizar `src/components/Scheduling.tsx`
- `useEffect` na montagem: ler `?code` e `?state` da URL, chamar `handleOAuthCallback`, limpar a query string e mostrar toast de sucesso.
- Tratar `?gcal_error=...` (mostrar toast).

### 6. Garantir Meet ao agendar
- Em `Scheduling.tsx`, ao criar appointment do tipo "Reunião" (e na sincronização que a IRIS faz quando agenda automaticamente via `nina-orchestrator`), passar `create_meet: true` para `syncAppointment`.
- O `meeting_url` retornado já é exibido no detalhe do agendamento ("Entrar na reunião"). Não precisa mudar UI, apenas passar a popular esse campo.

## Configuração necessária no Google Cloud Console

O redirect URI muda. Você precisará adicionar em **APIs & Services → Credentials → OAuth Client → Authorized redirect URIs**:
- `https://iris-axholding.lovable.app/scheduling` (URL publicada)
- `https://id-preview--45e1706a-406d-4541-ba2d-d84d92061b15.lovable.app/scheduling` (preview, opcional para testar antes de publicar)

Os secrets `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` já existem no projeto — não precisa adicionar nada.

## Detalhes técnicos

- Schema atual `google_calendar_connections` (campos `access_token`, `refresh_token`, `token_expires_at`, `is_active`, `calendar_id='primary'`) já é compatível — sem migração de banco.
- Coluna `appointments.meeting_url` já existe — sem migração.
- `verify_jwt = false` não é necessário (a função valida JWT no código via `getUser()`).
- Sem mudanças em RLS.

## Fora de escopo

- UI nova de calendário estilo "month/week/day grid" (a Iris já tem sua própria UI de agenda em `Scheduling.tsx`).
- Sincronização bidirecional (puxar eventos do Google de volta para a Iris).

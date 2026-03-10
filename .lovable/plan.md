

# Sincronização com Google Agenda

## Visão Geral
Implementar integração bidirecional entre o módulo de Agendamentos do sistema e o Google Calendar do usuário.

## Abordagem Recomendada

**Google Calendar API via Edge Function + OAuth**

### Fluxo
1. Usuário conecta sua conta Google (OAuth 2.0) nas Configurações
2. Sistema armazena tokens de acesso/refresh de forma segura
3. Ao criar/editar/cancelar agendamento no sistema → sincroniza com Google Calendar
4. (Opcional) Polling periódico ou webhook para trazer eventos do Google Calendar para o sistema

### Componentes Necessários

**Banco de Dados:**
- Tabela `google_calendar_connections` (user_id, access_token_encrypted, refresh_token_encrypted, calendar_id, is_active)

**Edge Functions:**
- `google-calendar-auth` -- inicia fluxo OAuth e troca código por tokens
- `google-calendar-sync` -- cria/atualiza/deleta eventos no Google Calendar
- `google-calendar-callback` -- recebe callback do OAuth

**Frontend:**
- Botão "Conectar Google Agenda" na página de Configurações ou Agendamentos
- Indicador visual de sincronização nos agendamentos

### Pré-requisitos
- Credenciais OAuth do Google Cloud Console (Client ID + Client Secret)
- Configuração do consent screen no Google Cloud

### Limitações
- Requer que o usuário configure um projeto no Google Cloud Console
- Tokens OAuth expiram e precisam de refresh automático

## Alternativa Mais Simples
Exportar agendamentos como links `webcal://` ou arquivos `.ics`, permitindo que o usuário adicione manualmente ao Google Agenda sem necessidade de OAuth.


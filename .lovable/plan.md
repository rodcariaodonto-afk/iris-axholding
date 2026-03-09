

# Plano: Migrar de WhatsApp Cloud API para Evolution API

## Contexto

O sistema atual usa a **WhatsApp Cloud API** (Meta/Facebook) em vários pontos: webhook de recebimento, envio de mensagens, download de mídia, configurações e onboarding. A Evolution API tem uma estrutura diferente — ela gerencia "instâncias" conectadas ao WhatsApp via QR code (Baileys) ou número verificado, e usa endpoints REST próprios.

## O que muda

A Evolution API precisa de:
- **URL do servidor** (onde a Evolution está hospedada, ex: `https://sua-evolution.com`)
- **API Key global** (chave de autenticação)
- **Nome da instância** (identificador da sessão WhatsApp)

Em vez de: Access Token, Phone Number ID, Business Account ID, Verify Token.

## Arquivos que precisam ser alterados

### 1. Banco de dados — Migração `nina_settings`
Adicionar colunas novas e um campo para selecionar o provider:
- `whatsapp_provider` (`cloud_api` | `evolution`) — default `evolution`
- `evolution_api_url` (text) — URL do servidor Evolution
- `evolution_api_key` (text) — API Key
- `evolution_instance_name` (text) — nome da instância

### 2. Edge Functions (backend)

| Função | Alteração |
|--------|-----------|
| `whatsapp-webhook` | Adaptar para receber payload no formato Evolution (`MESSAGES_UPSERT`) em vez do formato Meta |
| `whatsapp-sender` | Usar `POST /message/sendText/{instance}` da Evolution em vez de `graph.facebook.com` |
| `message-grouper` | Adaptar download de mídia para usar Evolution API (`/chat/getBase64FromMediaMessage/{instance}`) |
| `test-whatsapp-message` | Adaptar envio para Evolution API |
| `validate-setup` | Validar conexão com Evolution (ex: `GET /instance/connectionState/{instance}`) |
| `health-check` | Checar configuração Evolution |
| `simulate-webhook` | Adaptar formato do payload simulado |
| `simulate-audio-webhook` | Adaptar formato para Evolution |

### 3. Frontend (UI)

| Arquivo | Alteração |
|---------|-----------|
| `StepWhatsApp.tsx` (onboarding) | Trocar campos para: URL do servidor, API Key, Nome da instância. Remover campos Meta |
| `ApiSettings.tsx` (settings) | Mesma mudança nos campos de configuração |
| `OnboardingWizard.tsx` | Adaptar state e save para novos campos |
| `useOnboardingStatus.ts` | Adaptar validação de completude do step |
| `SystemRoadmap.tsx` | Atualizar tutorial/instruções |
| `SystemHealthCard.tsx` | Atualizar labels se necessário |

### 4. Formatos de API (principais diferenças)

**Enviar mensagem de texto (Evolution):**
```
POST {evolution_url}/message/sendText/{instance_name}
Headers: apikey: {api_key}
Body: { "number": "5511999999999", "text": "Olá!" }
```

**Receber mensagem (webhook Evolution — evento `MESSAGES_UPSERT`):**
```json
{
  "event": "messages.upsert",
  "instance": "nome-instancia",
  "data": {
    "key": { "remoteJid": "5511999999999@s.whatsapp.net", "fromMe": false },
    "message": { "conversation": "Olá" },
    "messageTimestamp": 1234567890
  }
}
```

**Enviar mídia (Evolution):**
```
POST {evolution_url}/message/sendMedia/{instance_name}
```

## Ordem de implementação

1. Migração do banco (adicionar colunas Evolution)
2. Adaptar `whatsapp-webhook` para formato Evolution
3. Adaptar `whatsapp-sender` para Evolution
4. Adaptar `message-grouper` (download de mídia Evolution)
5. Adaptar funções auxiliares (`test-whatsapp-message`, `validate-setup`, `health-check`)
6. Atualizar UI: `StepWhatsApp`, `ApiSettings`, `OnboardingWizard`
7. Atualizar hooks e roadmap

## Notas importantes

- A Evolution API requer um **servidor próprio** hospedado pelo usuário (self-hosted) ou um serviço cloud como EvolutionAPI Cloud. O usuário precisará fornecer a URL do seu servidor.
- O webhook da Evolution envia eventos no formato `MESSAGES_UPSERT` — completamente diferente do formato Meta.
- A autenticação usa `apikey` no header em vez de `Bearer token`.


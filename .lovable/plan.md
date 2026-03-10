

# Corrigir transcrição de áudio para Evolution API

## Problema
A transcrição de áudio **nunca executa** quando usando Evolution API. Dois motivos:

1. O código verifica `settings?.whatsapp_access_token` (linha 258), que é `null` no Evolution API — isso faz o bloco inteiro de transcrição ser pulado.
2. O código busca `messageData.audio?.id` para pegar o media ID do Meta Cloud API, mas no Evolution API o áudio vem em `audioMessage.url` (URL direta do WhatsApp).
3. A função `downloadWhatsAppMedia` usa a Graph API do Meta (`graph.facebook.com`), incompatível com Evolution API.

Resultado nos logs: `Combined content: ` (vazio) → Nina recebe conteúdo vazio → não consegue interpretar o áudio.

## Solução

### Alterações em `supabase/functions/message-grouper/index.ts`:

1. **Passar configurações completas do Evolution** (evolution_api_url, evolution_api_key, evolution_instance_name) para a função de transcrição, além do whatsapp_access_token.

2. **Detectar o provider** a partir dos dados da queue (o `phone_number_id` contém o instance name para Evolution).

3. **Adicionar função `downloadEvolutionMedia`** que baixa o áudio via a URL direta que vem no `audioMessage.url` do Evolution, ou via o endpoint de mídia do Evolution API (`/chat/getBase64FromMediaMessage`).

4. **Atualizar `combineAndTranscribeMessages`** para:
   - Buscar `nina_settings` incluindo campos do Evolution
   - Se tiver `evolution_api_url`, usar download via Evolution API
   - Se tiver `whatsapp_access_token`, usar download via Meta Cloud API (comportamento atual)
   - Extrair a URL do áudio de `messageData.audioMessage?.url` (Evolution) ou `messageData.audio?.id` (Cloud API)

5. **Na query de owner settings** (linha ~90), incluir os campos `evolution_api_url, evolution_api_key, evolution_instance_name`.

### Fluxo corrigido:
```text
Audio recebido via Evolution
  → webhook salva message_data com audioMessage.url
  → message-grouper detecta type === 'audio'
  → verifica: tem evolution_api_key? → baixa via Evolution API
  → transcreve com Whisper (auto-detect idioma)
  → salva transcrição no DB
  → envia para Nina com conteúdo transcrito
```

### Arquivos alterados:
- `supabase/functions/message-grouper/index.ts` — adicionar suporte a download de mídia via Evolution API e corrigir lógica de detecção de áudio


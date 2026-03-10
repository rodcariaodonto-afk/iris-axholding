

# Suporte Multilíngue na Transcrição de Áudio

## Problema
A transcrição de áudio está **hardcoded para português** (`language: 'pt'`) no `message-grouper/index.ts` (linha 340). Isso força o Whisper a interpretar todos os áudios como português, mesmo quando o áudio é em inglês ou outro idioma.

O mesmo problema existe no `simulate-audio-webhook/index.ts` que usa ElevenLabs Scribe sem especificar idioma (mas o Scribe auto-detecta, então esse é menor).

## Solução
Remover o parâmetro `language: 'pt'` fixo da chamada de transcrição no `message-grouper`. Sem esse parâmetro, o Whisper detecta automaticamente o idioma do áudio, permitindo transcrição multilíngue.

### Alteração em `supabase/functions/message-grouper/index.ts`:
- **Remover** a linha `formData.append('language', 'pt');` (linha 340)
- Whisper passará a auto-detectar o idioma do áudio

Isso é tudo que precisa mudar. Uma linha removida.


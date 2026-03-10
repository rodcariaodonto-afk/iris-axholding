

# Fix: Transcrição de áudio falhando — Lovable AI Gateway não suporta Whisper

## Problema

Os logs mostram claramente:
```
Transcription error: 400 {"error":{"message":"Input required: specify \"prompt\" or \"messages\"","code":400}}
```

O áudio é baixado com sucesso (23247 bytes), mas a transcrição falha porque o **Lovable AI Gateway não suporta o endpoint `/v1/audio/transcriptions` (Whisper)**. O gateway espera `prompt` ou `messages` — ou seja, é um endpoint de chat completions, não de transcrição de áudio.

## Solução

Substituir a função `transcribeAudio` para usar **Gemini Flash** via chat completions com o áudio em base64 inline. Gemini suporta input de áudio nativamente.

### Alteração em `supabase/functions/message-grouper/index.ts`:

1. **Remover** a constante `LOVABLE_AI_URL` (endpoint de transcriptions)
2. **Usar** `https://ai.gateway.lovable.dev/v1/chat/completions` com modelo `google/gemini-2.5-flash`
3. **Enviar** o áudio como base64 no formato inline_data do Gemini:

```typescript
async function transcribeAudio(audioBuffer: ArrayBuffer, lovableApiKey: string): Promise<string | null> {
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: { data: base64Audio, format: "ogg" }
          },
          {
            type: "text",
            text: "Transcribe this audio exactly as spoken. Return ONLY the transcription, nothing else. Detect the language automatically."
          }
        ]
      }]
    })
  });
  
  const result = await response.json();
  return result.choices?.[0]?.message?.content || null;
}
```

### Arquivo alterado:
- `supabase/functions/message-grouper/index.ts` — substituir `transcribeAudio` para usar Gemini via chat completions em vez de Whisper


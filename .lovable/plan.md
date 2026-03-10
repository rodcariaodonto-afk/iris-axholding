

## Plano: Habilitar recebimento, interpretação e envio de imagens/PDFs pela Nina

### Situacao Atual

1. **Recebimento (webhook)**: O webhook ja reconhece imagens e documentos, salvando com tipo `image`/`document` e content `[imagem recebida]`/`[documento recebido]`. Porem **nao faz download** da midia (so faz para audio).

2. **Interpretacao (nina-orchestrator)**: O orchestrator envia apenas texto para a IA. Nao baixa nem envia imagens/PDFs como conteudo multimodal. A IA recebe apenas `[imagem recebida]`.

3. **Envio (whatsapp-sender)**: Ja suporta enviar imagens e documentos via Evolution API e Cloud API. So precisa que o `media_url` esteja preenchido na send_queue.

4. **Frontend (ChatInterface)**: Nao exibe imagens/documentos inline - apenas o texto da mensagem.

### O que sera feito

#### 1. Message Grouper - Download de imagens/documentos
Estender `combineAndTranscribeMessages` no `message-grouper` para:
- Detectar mensagens do tipo `image` e `document` (alem de audio)
- Baixar a midia via Evolution API (`getBase64FromMediaMessage`) ou Meta Cloud API
- Fazer upload para o storage bucket (reutilizar `audio-messages` ou criar `media-files`)
- Salvar a `media_url` publica no registro da mensagem no banco

#### 2. Nina Orchestrator - Visao multimodal
Alterar `processQueueItem` no `nina-orchestrator` para:
- Verificar se a mensagem tem `media_url` e tipo `image`
- Montar a mensagem para a IA usando formato multimodal (content array com `image_url` + texto), aproveitando que Gemini suporta visao
- Para documentos PDF: baixar e converter para base64, enviar como conteudo para a IA interpretar (Gemini suporta PDFs nativamente)
- Adicionar instrucao no prompt: "O cliente enviou uma imagem/documento. Analise o conteudo visual e responda de acordo."

#### 3. Nina Orchestrator - Envio de imagens pela Nina
Adicionar uma tool de IA `send_image` para que a Nina possa enviar imagens quando necessario (ex: catalogos, materiais). Inicialmente, pode ser limitado a URLs pre-configuradas ou imagens do storage.

#### 4. Storage Bucket para midias
Criar bucket `media-files` (publico) para armazenar imagens e documentos recebidos/enviados.

#### 5. Frontend - Exibir midias no chat
Atualizar o `ChatInterface` para renderizar:
- Imagens inline com `<img>` quando `media_url` estiver presente e tipo for `image`
- Links clicaveis para documentos/PDFs

### Arquivos a serem modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/message-grouper/index.ts` | Download e upload de imagens/docs, salvar media_url |
| `supabase/functions/nina-orchestrator/index.ts` | Envio multimodal para IA (imagem+texto), interpretacao de PDFs |
| `src/components/ChatInterface.tsx` | Renderizar imagens e docs inline |
| Migration SQL | Criar bucket `media-files` |

### Detalhes tecnicos

- **Modelo de IA**: Gemini 2.5 Flash/Pro ja suporta visao (imagens) e PDFs nativamente via formato `image_url` com base64
- **Evolution API**: Endpoint `getBase64FromMediaMessage` ja usado para audio, sera reutilizado para imagens/docs
- **Formato multimodal para IA**:
```text
messages: [{
  role: "user",
  content: [
    { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } },
    { type: "text", text: "mensagem do cliente ou caption" }
  ]
}]
```


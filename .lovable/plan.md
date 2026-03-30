

## Plano: Corrigir carregamento de imagens no chat

### Problema
A screenshot mostra "Erro Imagem" no placeholder, indicando que a URL da imagem salva no banco (`media_url`) está quebrada ou inexistente. Isso acontece porque:

1. **Double-slash na URL da Evolution API** — O `evolution_api_url` tem trailing slash, gerando URLs como `https://domain.com//chat/getBase64...`, fazendo o download de mídia falhar
2. **Mensagens de imagem sem `media_url`** — Quando o download falha, a mensagem fica com `type = 'image'` mas sem `media_url`, e o chat tenta renderizar `msg.content` ("[imagem recebida]") como URL de imagem, o que falha

### Correções

#### 1. Sanitizar URL da Evolution API no message-grouper
Na função `downloadEvolutionMedia`, remover trailing slash do `evolutionApiUrl` antes de montar o endpoint:
```typescript
const baseUrl = evolutionApiUrl.replace(/\/+$/, '');
const endpoint = `${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`;
```

#### 2. Melhorar fallback de imagem no ChatInterface
Quando `media_url` é null e o tipo é IMAGE, em vez de tentar renderizar o conteúdo textual como imagem (que falha), mostrar um placeholder informativo:
- Verificar se `imageUrl` realmente é uma URL válida antes de renderizar `<img>`
- No `onError`, mostrar um ícone de imagem quebrada com texto "Imagem indisponível" em vez do placeholder externo que também pode falhar (depende de rede)

#### 3. Sanitizar URL no whatsapp-sender também
Mesma correção de trailing slash na função `sendMessageEvolution` do `whatsapp-sender/index.ts` (já tem `replace(/\/$/, '')` mas usa regex simples — melhorar para `replace(/\/+$/, '')`).

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/message-grouper/index.ts` | Sanitizar `evolutionApiUrl` na linha 441 |
| `src/components/ChatInterface.tsx` | Melhorar fallback de imagem (linhas 282-309) — usar placeholder inline em vez de URL externa |


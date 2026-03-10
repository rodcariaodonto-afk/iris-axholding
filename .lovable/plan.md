

## Analise: Como a Nina pode enviar PDFs automaticamente?

### Situacao atual

A Nina **nao tem** uma ferramenta de envio de arquivos implementada. O plano anterior mencionou isso, mas a tool `send_image`/`send_document` nao foi criada no orchestrator. O `whatsapp-sender` ja suporta enviar documentos — falta apenas a Nina saber **de onde buscar** os arquivos e **ter a tool** para acionar o envio.

### Problema central

A Nina precisa de uma **biblioteca de arquivos** — um lugar onde vocês fazem upload de PDFs, catálogos, tabelas de preço, propostas, etc. Sem isso, ela nao tem de onde puxar um arquivo para enviar.

### Proposta

#### 1. Criar tabela `media_library` (biblioteca de arquivos)
Tabela onde admins cadastram arquivos que a Nina pode enviar:
- `name` — nome amigável (ex: "Catálogo 2026", "Tabela de Preços")
- `description` — quando a Nina deve enviar este arquivo (ex: "Enviar quando cliente pedir preços")
- `file_url` — URL do arquivo no storage
- `file_type` — image, document
- `tags` — categorias para a Nina encontrar o arquivo certo
- `is_active` — se está disponível para envio

#### 2. Interface de upload no painel (Settings ou seção dedicada)
Tela onde o admin pode:
- Fazer upload de PDFs/imagens para o bucket `media-files`
- Dar nome e descrição para cada arquivo
- A descrição orienta a Nina sobre quando usar aquele arquivo

#### 3. Tool `send_file` no nina-orchestrator
Nova tool de IA que:
- Recebe o nome/descrição do arquivo que a Nina quer enviar
- Busca na `media_library` o arquivo mais adequado
- Insere na `send_queue` com `message_type: 'document'` e o `media_url`
- O `whatsapp-sender` já cuida do envio real

#### 4. Instrucao no prompt
Adicionar ao prompt da Nina que ela tem acesso a uma biblioteca de arquivos e pode enviar PDFs/imagens quando relevante.

### Arquivos a modificar/criar

| Arquivo | Mudanca |
|---|---|
| Migration SQL | Criar tabela `media_library` |
| `src/components/settings/MediaLibrary.tsx` | **Novo** — UI de upload e gestão de arquivos |
| `src/components/Settings.tsx` | Adicionar aba/seção da biblioteca |
| `supabase/functions/nina-orchestrator/index.ts` | Adicionar tool `send_file` |

### Fluxo resumido

```text
Admin faz upload de PDF → media_library (com nome + descrição)
                              ↓
Cliente pergunta sobre preços → Nina identifica contexto
                              ↓
Nina chama tool send_file("Tabela de Preços")
                              ↓
Busca na media_library → encontra URL → insere na send_queue
                              ↓
whatsapp-sender envia o PDF via WhatsApp
```


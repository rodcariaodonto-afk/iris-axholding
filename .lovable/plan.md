# Plano: Envio da campanha via template aprovado do Meta

## Contexto
Hoje o `campaign-dispatcher` enfileira a mensagem de abertura como **texto livre** e o `whatsapp-sender` envia como texto puro. Pelo Meta Cloud API, texto livre para lead frio (fora da janela de 24h) é aceito na API mas marcado como `failed` na entrega — foi exatamente o que aconteceu (0 entregues de ~80).

O template aprovado é:
- **Nome:** `sofia_mensagem1`
- **Idioma:** `pt_BR`
- **Estrutura:** só corpo de texto, **sem header, sem documento, sem variáveis**

Como o template não tem header de documento, o **PDF não pode ir junto** nem ser enviado proativamente para lead frio. O PDF só pode ser enviado **depois que o contato responder** (aí abre a janela de 24h e a Nina/atendente envia o material na conversa).

## O que será feito

### 1. Banco de dados (migration + dados)
- Adicionar em `outbound_campaigns` as colunas `template_name` (texto) e `template_language` (texto, padrão `pt_BR`).
- Preencher a campanha atual "Recuperação Leads Frios - Permissão PDF" com `template_name = 'sofia_mensagem1'`.

### 2. `whatsapp-sender` (envio ao Meta)
- Adicionar suporte a `message_type = 'template'` na função do Cloud API, montando:
```text
{ messaging_product, to, type: "template",
  template: { name, language: { code } } }
```
- Nome/idioma do template vêm da metadata do item da fila.
- O registro em `messages` continua guardando o texto de exibição (`opening_message`) para aparecer no CRM.

### 3. `campaign-dispatcher`
- Quando a sessão for **Meta Cloud** e a campanha tiver `template_name`: enfileirar a abertura como `message_type: 'template'` com a metadata do template.
- **Não enfileirar o PDF proativamente** (registrar em log que o PDF será enviado após a resposta do lead).
- Manter o comportamento antigo de texto livre para sessões que não são Meta Cloud (ex.: Evolution/QR), onde texto livre é permitido.

### 4. Frontend (`Campaigns.tsx` + `useOutboundCampaigns.tsx`)
- Adicionar no formulário de criação de campanha os campos **Nome do template** e **Idioma** (padrão `pt_BR`).
- Incluir esses campos em `CreateCampaignInput` e no insert.
- Deixar claro na UI que, para o número Meta Cloud, a abertura precisa de um template aprovado.

### 5. Reenvio dos contatos que falharam
- Resetar para `pending` os contatos da campanha atual que ficaram como `sent`/`failed` mas cujas mensagens não foram entregues, para que o dispatcher os reenvie via template.
- Limpar da `send_queue` os itens antigos (`completed`/`failed`) desta campanha para não duplicar.
- O reenvio respeita o **limite diário (40/dia)** e o **delay (~45s)** entre mensagens, então a base será processada aos poucos ao longo dos próximos dias.

## Detalhes técnicos
- Payload de template sem variáveis não leva `components`.
- Envio segue em `https://graph.facebook.com/v18.0/{phone_number_id}/messages` com `Authorization: Bearer {access_token}` (já existente).
- Status real de entrega continua chegando pelo `whatsapp-webhook` (`sent`/`delivered`/`read`/`failed`), então dá pra confirmar a entrega de verdade após o reenvio.
- A janela de 24h para enviar o PDF é aberta pela resposta do contato; o fluxo de PDF pós-resposta fica a cargo da Nina/atendente na conversa.

## Validação
Após implementar, disparo um lote pequeno via `campaign-dispatcher` e confirmo no banco/webhook se os status chegam como `delivered` (e não `failed`), comprovando que o template está sendo entregue de verdade.

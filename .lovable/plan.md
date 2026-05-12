# Painel de Sessões no Chat ao Vivo (modelo Axis)

Replicar o layout do Axis: na aba **Chat**, exibir à esquerda um painel listando as sessões WhatsApp conectadas; ao clicar em uma sessão, a lista de conversas no meio mostra apenas os contatos daquele número. exato, porem o usuario que cadaastrou o seu whatsapp, ele ve a sessao do outro, mas nao ve as conversas, so consegue ver as conversas do outro quando a conversa for transferida para ele.

## Layout alvo

```
┌──────────────┬─────────────────┬──────────────────┐
│  Sessões     │  Chats Ativos   │  Conversa        │
│  ─────────   │  (filtrados     │                  │
│  ▣ Todas     │   pela sessão   │                  │
│  ● Iris-AX   │   selecionada)  │                  │
│  ● Suporte   │                 │                  │
└──────────────┴─────────────────┴──────────────────┘
```

## Mudanças

### 1. `useConversations.ts`

- Incluir `session_id` no SELECT de `conversations` e propagar para `UIConversation` (campo novo `sessionId: string | null`).
- Já existe realtime; apenas garantir que `mapToUIConversation` carrega o campo.

### 2. Novo componente `src/components/chat/SessionsSidebar.tsx`

- Carrega `whatsapp_sessions` da `activeAccountId` (apenas `status = 'connected'` + sessões com conversas).
- Renderiza:
  - Item "Todas" (default).
  - Um item por sessão: nome + telefone + badge do provedor (Evolution/Meta) + contagem de conversas atribuídas.
- Subscribe realtime em `whatsapp_sessions` (filtro account_id) para refletir conexões/desconexões.
- Props: `selectedSessionId: string | "all" | null`, `onSelect(id)`.

### 3. `ChatInterface.tsx`

- Estado novo: `selectedSessionId` (default `"all"`).
- Renderizar `SessionsSidebar` como nova coluna à esquerda do painel "Chats Ativos" (largura ~240px, colapsável em telas estreitas).
- Em `filteredConversations`, adicionar filtro: `selectedSessionId === "all" || c.sessionId === selectedSessionId`.
- No item da lista de conversas (se houver mais de uma sessão), mostrar um chip pequeno com o nome curto da sessão para identificar a origem.
- Atualizar contagem do rodapé para refletir filtro.

### 4. Layout responsivo

- ≥1280px: três colunas visíveis (Sessões | Chats | Conversa).
- 1024–1279px: Sessões vira ícones colapsados (apenas avatar + status).
- <1024px: dropdown de sessão acima da lista de chats.

## Fora de escopo

- Editar sessões ou criar nova sessão a partir do painel (continua só em Configurações → WhatsApp).
- Mudar regras de atribuição/transferência (já implementadas).

Filtros adicionais por status (Aberto/Atend./Aguard./Grupos do print) — fica para iteração futura se você pedir.  
porem o usuario que cadaastrou o seu whatsapp, ele ve a sessao do outro, mas nao ve as conversas, sop consegue ver as conversas do outro quando a conversa for transferida para ele.,
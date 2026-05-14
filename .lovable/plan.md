# Plano: Responsividade Mobile Completa (Android/iOS)

Objetivo: tornar toda a UI da Iris utilizável e elegante em telas <768px (smartphones), com adaptações intermediárias para tablet (768–1024px), mantendo o design system atual (dark theme, tokens semânticos, brand AXHUB).

## Escopo (somente frontend/UI)

### 1. Shell da aplicação (`App.tsx` + `Sidebar.tsx`)
- Substituir o sidebar fixo por **drawer mobile** (`Sheet` do shadcn) abaixo de `md`.
- Adicionar **TopBar mobile** (logo + botão menu hambúrguer + AccountSwitcher compacto) visível só em `<md`.
- `AppLayout`: empilhar verticalmente em mobile (TopBar acima, conteúdo abaixo); manter sidebar lateral em ≥md.
- Reduzir os "ambient glows" em mobile (perf + visual).

### 2. Chat ao Vivo (`ChatInterface.tsx` + `chat/SessionsSidebar.tsx`)
Hoje são 3 colunas (Sessões | Conversas | Mensagens). Em mobile vira **navegação por etapas**:
- Tela 1: Sessões WhatsApp (lista cheia)
- Tela 2: Conversas da sessão escolhida (com botão voltar)
- Tela 3: Janela de mensagens (com botão voltar + nome do contato no header)
- Em ≥lg manter as 3 colunas atuais.
- Tornar input de mensagem, anexos, emoji picker e modal de transferência mobile-friendly (botões ≥44px, teclado virtual ok, `dvh` no container).

### 3. Pipeline / Kanban (`Kanban.tsx`)
- Em mobile: scroll horizontal por colunas com **snap** (`snap-x snap-mandatory`), cada coluna ocupa ~85vw.
- Cards do deal otimizados (padding/typography reduzidos, ações em menu).
- Modais (`CreateDealModal`, `LostReasonModal`, `PipelineSettingsModal`) em fullscreen no mobile.

### 4. Dashboard (`Dashboard.tsx`)
- Já parcialmente responsivo. Ajustar grid para 1 coluna em mobile, KPIs em 2 colunas, gráficos full-width com altura reduzida.

### 5. Contatos (`Contacts.tsx`)
- Tabela vira **cards empilhados** em mobile (avatar + nome + telefone + tags + menu de ações).
- Filtros e busca colapsáveis num `Sheet` "Filtros".

### 6. Agendamentos (`Scheduling.tsx`)
- Calendário: alternar para visão "Lista/Agenda" por padrão em mobile (mês full ocupa demais).
- Form de novo agendamento em `Sheet`/Dialog fullscreen.

### 7. Relatórios (`Reports.tsx` + `reports/*`)
- Tabs roláveis horizontalmente.
- KPIs em 2 colunas no mobile, gráficos com `ResponsiveContainer` e altura mínima 240px.

### 8. Configurações (`Settings.tsx` + `settings/*`)
- Tabs verticais → `Select` no mobile (padrão shadcn) ou tabs horizontais com scroll.
- Forms: inputs full-width, agrupamentos em accordions.

### 9. Equipe / Conta / Admin / Governança
- Tabelas viram cards em mobile.
- Layouts secundários (`AccountLayout`, `AdminLayout`, `GovernanceLayout`) ganham menu lateral colapsável em `Sheet`.

### 10. Auth, Onboarding, MeetingRoom, InviteAccept
- Validar paddings, alturas (`min-h-dvh`), formulários e wizard `OnboardingWizard` (já é dialog, mas precisa de fullscreen no mobile).
- `MeetingRoom` (Jitsi iframe): garantir 100dvh sem barras quebradas.

### 11. Cross-cutting (utilitários)
- Hook `useIsMobile` já existe — usar consistentemente.
- Trocar `h-screen` crítico por `h-dvh`/`min-h-dvh` (resolve barra do Safari iOS).
- Garantir tap targets ≥44px (`min-h-11 min-w-11` em botões `size="icon"` principais).
- Adicionar `viewport-fit=cover` no `index.html` + `safe-area-inset-*` para iPhone com notch.
- Toaster (sonner): posição `top-center` em mobile.

## Detalhes técnicos
- Breakpoints Tailwind padrão: `sm 640`, `md 768`, `lg 1024`, `xl 1280`.
- Sem novas dependências — `Sheet`, `Dialog`, `Tabs`, `Select` do shadcn já disponíveis.
- Sem mudança de lógica de negócio, RLS, edge functions ou schema. Apenas camada de apresentação.
- Tokens HSL semânticos do `index.css` mantidos; nenhuma cor hardcoded nova.

## Entrega sugerida (ordem)
1. Shell + Sidebar drawer + TopBar mobile + safe-area  
2. Chat (maior impacto UX)  
3. Kanban  
4. Dashboard + Reports  
5. Contatos + Agendamentos  
6. Configurações + Equipe + Conta/Admin/Governança  
7. Polimento (Auth, Onboarding fullscreen, MeetingRoom, Toaster)

## Fora de escopo
- PWA / instalação no home screen (posso adicionar depois se quiser).
- Capacitor / build nativo iOS/Android (idem).
- Mudanças de backend/Cloud, novas features ou refatoração de dados.

Quer que eu inclua **PWA instalável** já nesta entrega (manifest + ícones + service worker), ou mantemos só responsividade web pura?

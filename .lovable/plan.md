# Landing Page IRIS — Plano de Implementação

## Objetivo

Criar landing page pública premium na rota `/` da plataforma IRIS, mantendo `/auth` como login para clientes existentes. Seguir o mesmo padrão modular das landings dos projetos **RH AXHolding** e **Axis Operations Hub** (header → hero → módulos/benefícios → como funciona → preço → FAQ → contato → footer + WhatsApp FAB).

## Roteamento

- `/` → nova `LandingPage` (pública, sem ProtectedRoute)
- `/auth` → preservada como está
- `/dashboard` e demais rotas → permanecem protegidas
- Atualizar redirect do catch-all e do `/` para apontar para a landing em vez de `/dashboard`
- Usuário autenticado que acessa `/` continua vendo a landing (pode ter botão "Acessar plataforma" → `/dashboard`)

## Estrutura de arquivos (novo)

```
src/pages/LandingPage.tsx
src/components/landing/
  LandingHeader.tsx       — logo IRIS + nav (Benefícios, Como funciona, Preço, FAQ) + CTAs
  LandingHero.tsx         — headline, subtítulo, badges, CTAs primário/secundário
  ProofSection.tsx        — 4 cards de prova de valor (Atendimento, Qualificação, Centralização, Próxima ação)
  PainSection.tsx         — dores que a IRIS resolve
  TransformSection.tsx    — antes/depois em 2 colunas
  ProductShowcase.tsx     — mockups: Chat, Dashboard, Kanban, Lead score
  FeaturesSection.tsx     — cards de funcionalidades → benefícios comerciais
  HowItWorksSection.tsx   — 5 passos (Diagnóstico → Operação)
  PricingSection.tsx      — Plano único: Setup R$ 2.500 + R$ 120/mês
  FaqSection.tsx          — perguntas frequentes do PDF
  ContactSection.tsx      — CTA final + link WhatsApp
  LandingFooter.tsx       — institucional + links
  WhatsAppFAB.tsx         — botão flutuante WhatsApp
  whatsappLink.ts         — helper com número e mensagem pré-definida
```

## CTA WhatsApp

Helper único `whatsappLink.ts`:

```text
Número: 5511939171383
Mensagem: "Olá, quero implementar a IRIS Agente de IA na minha empresa. Pode me apresentar a plataforma?"
URL: https://wa.me/5511939171383?text=<mensagem url-encoded>
```

Todos os botões "Quero implementar a IRIS" / "Agendar demonstração" / FAB usam esse helper. Botão secundário "Já sou cliente / Acessar plataforma" → `/auth`.

## Identidade visual

Reaproveitar tokens do `index.css` atual (dark premium: `--background` slate-950, `--primary` ciano #22d3ee, `--accent` violeta). Cards `bg-slate-900/60` com borda `slate-700/40`, blur, glow ciano/roxo. Framer Motion já está no projeto — usar para entrada de seções e hover sutil. Mesma estrutura visual e densidade das landings de referência.

## Conteúdo (do PDF anexo)

- **Hero**: "Transforme conversas do WhatsApp em vendas com uma Agente SDR de IA trabalhando por você."
- **Plano único**: Setup R$ 2.500 + R$ 120/mês, observação sobre integrações extras
- **5 passos**: Diagnóstico → Setup → Integração WhatsApp → Treinamento do agente → Operação
- **FAQ**: substitui vendedor? funciona com WhatsApp? o que está incluso? quanto tempo? etc.
- **SEO**: title "IRIS Agente de IA SDR — Atendimento e Vendas pelo WhatsApp"; description e keywords conforme PDF; atualizar `index.html` + meta dinâmica via useEffect

## Detalhes técnicos

- Toda a landing é client-side React (sem backend novo)
- `App.tsx`: adicionar `<Route path="/" element={<LandingPage />} />` **fora** do `ProtectedRoute`; mover redirect atual para `/dashboard` apenas no catch-all autenticado
- Mobile-first: hero empilhado, nav vira menu hamburguer, mockups responsivos
- Sem alterações em Supabase, Edge Functions ou lógica de negócio
- Sem mudanças nas demais páginas/componentes do app

## Critérios de aceite

- `https://www.axiris.com.br/` exibe a landing (não redireciona para login)
- `/auth` continua funcionando para login
- CTAs primários abrem WhatsApp `(11) 93917-1383` com mensagem pré-preenchida
- "Já sou cliente" leva para `/auth`
- Layout responsivo, sem quebrar nenhuma rota existente
- Mesma linguagem visual das landings AXHolding e AXIS

## Dúvidas antes de implementar

1. **Logo da IRIS**: uso o nome em texto com gradiente ciano→violeta (mesmo estilo do AXHUB no app), ou você tem um arquivo de logo para eu usar?
2. **Mockups do produto**: gero screenshots ilustrativos dos painéis (chat / dashboard / kanban) usando componentes mock estilizados, ou prefere que eu reutilize screenshots reais do app atual?
3. **Domínio do CTA secundário**: confirmo que "Já sou cliente" deve ir para `/auth` (mesmo domínio) e não abrir uma nova aba?

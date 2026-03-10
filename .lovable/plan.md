

## Plano: Copiar RemixOverlay do projeto Nina Evolution

### Alterações

1. **Criar `src/components/RemixOverlay.tsx`** - Copiar o componente completo do projeto de origem (overlay animado com 3 cards instrucionais: abrir menu, remix, ativar toggle)

2. **Modificar `src/pages/Auth.tsx`** - Importar e renderizar `<RemixOverlay />` antes do div principal

### Detalhes Técnicos
- O componente usa `framer-motion` (já instalado) e `lucide-react` (já instalado)
- Overlay fixo com `z-[9999]` que cobre toda a tela com instruções visuais de como remixar o projeto
- Será exibido na página de autenticação como no projeto original


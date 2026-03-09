

# Plano: Ativar botão "Novo Contato" e trocar logo do sidebar

## Alterações

### 1. Ativar botão "Novo Contato" (Contacts.tsx)
- Remover `disabled`, `opacity-50`, `cursor-not-allowed` do botão "Novo Contato"
- Adicionar lógica para abrir um modal ou formulário de criação de contato (inicialmente pode ser um placeholder com toast)

### 2. Trocar logo "VIVER DE IA" pela logo AXHUB (Sidebar.tsx)
- Copiar a imagem AXHUB (`user-uploads://06bab71e-...jpeg`) para `src/assets/logo-axhub.png`
- No footer do sidebar (linhas 115-129), substituir `viaLogoWhite` pela nova logo AXHUB
- Atualizar o alt text

### Arquivos modificados
- `src/assets/logo-axhub.png` — nova imagem
- `src/components/Sidebar.tsx` — trocar logo no footer
- `src/components/Contacts.tsx` — ativar botão "Novo Contato"


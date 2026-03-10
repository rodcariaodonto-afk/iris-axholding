

## Problema

A URL publicada (`nina-axhub.lovable.app`) ainda mostra a marca antiga "Viver de IA" porque:

1. **Favicon antigo**: `public/favicon.png` e `public/favicon.ico` ainda contêm o logo "VIA" (Viver de IA)
2. **Título da página**: `index.html` tem "Dashboard | Sistema SDR" -- pode ser atualizado para AXHUB
3. **metadata.json**: Ainda diz "Viver de IA - SaaS Platform"
4. **Arquivos de assets antigos**: `src/assets/icon-via.png`, `logo-via.png`, `logo-via-white.png` ainda existem (não são usados no código, mas ocupam espaço)

O código da sidebar já usa corretamente `icon-axhub.png` e `logo-axhub.png`, então o problema não é no React -- é nos arquivos estáticos e metadados.

## Plano

### 1. Atualizar o favicon
- Substituir `public/favicon.png` pela imagem `src/assets/icon-axhub.png` (o ícone da AXHUB)
- Fazer o mesmo para `public/favicon.ico`

### 2. Atualizar metadados no `index.html`
- Título: "AXHUB | Dashboard"
- Description e OG tags: atualizar referências

### 3. Atualizar `metadata.json`
- Nome: "AXHUB - SaaS Platform"

### 4. Limpar assets antigos
- Remover `src/assets/icon-via.png`, `logo-via.png`, `logo-via-white.png` (não são referenciados no código)

### 5. Após deploy
- O favicon antigo pode ficar em cache no navegador -- será necessário limpar cache ou abrir em aba anônima para confirmar

---

**Nota sobre o deploy**: Após eu fazer estas alterações, será necessário republicar clicando em "Share → Publish → Update" para que a URL pública reflita as mudanças. Mudanças no frontend (HTML, assets) precisam de republish manual.


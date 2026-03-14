

## Plano: Logo customizavel + Modelo de prompt para download

### 1. Logo da empresa nas configuracoes

**Problema:** O sidebar mostra o icone AXHUB fixo. Empresas que compram o produto precisam colocar sua propria logo.

**Solucao:**
- Adicionar coluna `company_logo_url` (text, nullable) na tabela `nina_settings`
- Na secao "Informacoes da Empresa" do `AgentSettings.tsx`, adicionar campo de upload de logo (imagem ate 2MB)
- Upload vai para o bucket `media-files` (ja existe, publico)
- No `Sidebar.tsx`, usar a logo do `nina_settings` quando disponivel, senao mostrar o icone AXHUB padrao
- Atualizar `useCompanySettings` para expor `companyLogoUrl`

### 2. Modelo de prompt para download

**Problema:** O usuario precisa de um template de prompt para baixar e adaptar ao seu negocio.

**Solucao:**
- Adicionar botao "Baixar Modelo" ao lado de "Restaurar Padrao" e "Gerar com IA" na secao de prompt do `AgentSettings.tsx`
- O botao gera um arquivo `.txt` com o conteudo do `DEFAULT_NINA_PROMPT` para download
- Incluir cabecalho com instrucoes de personalizacao no arquivo

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| Migration SQL | Adicionar `company_logo_url` em `nina_settings` |
| `src/hooks/useCompanySettings.tsx` | Expor `companyLogoUrl` |
| `src/components/settings/AgentSettings.tsx` | Upload de logo + botao "Baixar Modelo" de prompt |
| `src/components/Sidebar.tsx` | Usar logo customizada quando disponivel |


## O que será feito

Adicionar um botão **"Encerrar acesso"** no painel Super Admin para encerrar a impersonação de uma conta cliente, removendo automaticamente o vínculo temporário criado.

## Respostas às suas perguntas

**1. Consigo configurar a Iris e as APIs para o cliente com esse acesso?**
Sim. Ao impersonar, você entra como `admin` da conta cliente. Tem acesso total a:
- Configurações da Iris/Sofia (prompt, comportamento, agente)
- APIs (Evolution, Meta Cloud, ElevenLabs, Google Calendar)
- Pipeline, biblioteca de mídia, campanhas, membros
- Todas as áreas que um admin da conta acessa

**2. O cliente sabe que você acessou?**
Do ponto de vista da interface do cliente: **não há notificação visual** para ele. Você aparece apenas como mais um membro admin na lista de membros da conta (se ele abrir Configurações → Membros, verá seu email lá enquanto o acesso estiver ativo).

Do ponto de vista de auditoria: fica registrado em `audit_logs` (log interno do sistema, não exposto ao cliente na UI atual).

**Recomendação de suporte discreto:** ao terminar o suporte, clicar em "Encerrar acesso" remove o vínculo — assim seu email só fica visível na lista de membros dele durante a janela de atendimento.

## Escopo da implementação

### Backend
- Nova Edge Function `super-admin-end-impersonation`:
  - Valida que quem chama é Super Admin
  - Remove a membership marcada com flag de impersonação (`is_impersonation: true` em `account_members`) da conta alvo
  - Registra em `audit_logs` o encerramento
  - Não afeta memberships legítimas (só remove as criadas via impersonação)

### Frontend (`src/components/admin/AdminAccounts.tsx`)
- Detectar contas onde existe uma impersonação ativa do usuário atual
- Trocar dinamicamente o botão: mostrar **"Acessar"** quando não há impersonação ativa, e **"Encerrar acesso"** (variante destrutiva) quando há
- Ao clicar em "Encerrar acesso":
  1. Chama a edge function
  2. Se o `activeAccountId` for o da conta encerrada, troca para a AXHolding
  3. Recarrega a lista de contas e memberships

### Comportamento
- Se você esquecer de encerrar, o acesso persiste até você clicar no botão
- Encerrar não afeta admins reais da conta (o cliente e equipe dele continuam intactos)
- Toda ação (início e fim da impersonação) fica em `audit_logs` para conformidade

## Detalhes técnicos

- Filtro de identificação: `account_members` onde `user_id = <super_admin>` AND `metadata->>'is_impersonation' = 'true'` (ou coluna equivalente já usada na criação)
- A edge function usa service_role para conseguir remover o vínculo bypassando RLS
- CORS habilitado, `verify_jwt` conforme padrão do projeto

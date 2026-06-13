## Problema

A validação da conta **Vila do Corpo** continua com erro em **Pipeline** e **Perfil** porque os dados realmente não existem no banco — não é um bug de tela, é falta de registro:

- **Pipeline**: a conta Vila do Corpo (`fbb1ad4b…`) tem **0 estágios**. Todos os 6 estágios existentes pertencem só à conta AXHolding.
- **Perfil**: o usuário dono da Vila do Corpo (`rodcaria.odonto@gmail.com`) **não tem linha na tabela `profiles`**. Por isso, mesmo "configurando o perfil" na tela, a validação não encontra o registro.

O botão "Inicializar Sistema" não resolve: a função `initialize-system` só cria dados globais para o *primeiro* usuário e não escreve `account_id`, então não serve para uma segunda conta.

## Solução

Inserir os dados que faltam, isolados pela conta Vila do Corpo.

### 1. Criar o perfil do usuário
Inserir uma linha em `profiles` para o usuário `14a5d0a5…` (rodcaria.odonto@gmail.com) com `full_name` = "teste 1".

### 2. Criar os estágios de pipeline da Vila do Corpo
Inserir os 6 estágios padrão com `account_id = fbb1ad4b…`, espelhando o padrão da AXHolding:

```text
Novos Leads      (pos 0,  azul)
Em Qualificação  (pos 1,  amarelo, IA)
Oportunidade     (pos 2,  roxo, IA)
Fechamento       (pos 3,  laranja)
Ganho            (pos 4,  verde, sistema)
Perdido          (pos 5,  vermelho, sistema)
```

## Detalhes técnicos

- Inserção via ferramenta de dados (insert), escopada por `account_id`/`user_id` — não altera schema.
- `pipeline_stages.account_id` é `NOT NULL`; cada linha receberá `fbb1ad4b-7d44-4994-842a-b091fc33dcf0`.
- Após inserir, revalido com consulta ao banco para confirmar 6 estágios + perfil presentes, de modo que `validate-setup` retorne tudo OK para a Vila do Corpo.

## Fora de escopo

Não vou reescrever a função `initialize-system` para multi-tenant nesta etapa (correção maior, opcional). Posso fazer depois se você quiser que novas contas recebam pipeline/tags automaticamente.
# Isolar o prompt de cada cliente (fim da contaminação Nina/Viver de IA)

## O que está acontecendo (verificado)

1. Existe um prompt padrão fixo com a persona "Nina, Assistente do Viver de IA" em três lugares do sistema:
   - a função de IA (`nina-orchestrator`) usa esse texto sempre que a conta não tem prompt próprio salvo;
   - o app pré-preenche o campo de prompt com ele no Onboarding e em Configurações > Agente;
   - a rotina de inicialização de conta grava esse texto (e o nome de empresa "Viver de IA") como configuração inicial.
2. Consequência real hoje no banco: a conta **ME ARTE & TECNOLOGIA** está com o prompt da Nina/Viver de IA salvo (5.699 caracteres com menções a "Viver de IA"). As demais contas (AXHolding, Directconstru, DRM, R R Holding) têm prompt próprio — a AXHolding cita "Nina" por escolha dela.
3. Além do prompt, a função de IA sempre acrescenta blocos fixos ao final do prompt do cliente: instruções de idioma, uma regra crítica de agendamento e contexto do contato. Isso não mistura clientes, mas mistura comportamento não pedido com o texto do cliente.

Nenhuma mistura entre contas diferentes foi encontrada nas conversas/memórias — o vazamento é do prompt padrão embutido no código, não de dados de outro cliente.

## O que será feito

**1. Acabar com o prompt padrão de persona**
- Remover o texto "Nina / Viver de IA" do código da IA. Se a conta não tiver prompt próprio, a IA usa apenas um prompt neutro mínimo (assistente de atendimento da empresa, responder em pt-BR) — nunca uma persona de outra marca.
- Onboarding e Configurações > Agente passam a abrir com o campo vazio e um texto de exemplo/placeholder neutro, com botão opcional "usar modelo em branco" (estrutura genérica, sem marca, sem nome de agente).
- A criação de conta nova deixa de gravar o prompt da Nina e o nome de empresa "Viver de IA".

**2. Respeitar exatamente o prompt do cliente**
- O prompt do cliente entra íntegro como instrução principal, e o sistema só acrescenta, em bloco separado e claramente subordinado, o mínimo operacional: data/hora, nome do contato e capacidades ativas (agenda/arquivos) quando ligadas.
- A "regra crítica de agendamento" só é anexada quando o agendamento por IA está habilitado na conta; caso contrário nada é anexado.
- Se houver conflito, prevalece o texto do cliente.

**3. Limpeza de dados**
- Zerar o prompt contaminado da conta ME ARTE & TECNOLOGIA (fica em branco, para o cliente escrever o dele) — confirmo antes de apagar.

**4. Verificação**
- Conferir conta a conta que o prompt em uso é o do próprio cliente e testar uma resposta real por conta com prompt configurado.

## Detalhes técnicos

- `supabase/functions/nina-orchestrator/index.ts`: remover `getDefaultSystemPrompt()` (persona Viver de IA) e substituir por prompt neutro; tornar condicionais os anexos em `requestBody.messages[0]`; manter `buildEnhancedPrompt` apenas com contexto do contato/campanha.
- `src/prompts/default-nina-prompt.ts`: substituir por um template neutro sem marca/nome de agente (ou remover e ajustar os importadores).
- `src/components/OnboardingWizard.tsx` e `src/components/settings/AgentSettings.tsx`: parar de pré-preencher com `DEFAULT_NINA_PROMPT`.
- `supabase/functions/initialize-system/index.ts`: `DEFAULT_NINA_SETTINGS` sem `system_prompt_override` e sem `company_name: 'Viver de IA'`.
- Deploy das funções alteradas + update pontual em `nina_settings` da conta afetada.

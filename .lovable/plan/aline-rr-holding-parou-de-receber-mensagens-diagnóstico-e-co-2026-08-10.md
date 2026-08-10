# Aline (RR Holding) parou de receber mensagens — diagnóstico e correção

## O que foi verificado agora

- A sessão "Aline" da conta R R HOLDING LTDA existe, está com status `connected` e vinculada à instância `iris-de65f931-fa1d5082-28513b79` (verificação de conexão feita hoje às 17:34 BRT).
- A última mensagem registrada para a RR Holding foi em **09/08 às 21:30 (Brasília)**. Depois disso, nada entrou.
- Não há nenhum item na fila de processamento de mensagens dessa conta.
- Outro cliente no **mesmo servidor Evolution** (DRM) recebeu mensagens normalmente hoje, inclusive às 16:59 BRT — ou seja, o sistema e o webhook estão funcionando.

Conclusão: o problema é específico da instância da RR Holding. A conexão do WhatsApp está aberta, mas a Evolution não está entregando os eventos de mensagem para o nosso webhook — comportamento típico de configuração de webhook perdida na instância (acontece após restart/reconexão do servidor Evolution). O diagnóstico ainda precisa ser confirmado lendo a configuração atual do webhook na instância.

## Correção proposta

1. Consultar na Evolution a configuração de webhook da instância da RR Holding e confirmar se está ausente, desabilitada, com URL errada ou sem o evento de mensagens.
2. Reaplicar a configuração correta: URL do `whatsapp-webhook` do projeto, habilitado, com os eventos `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE` e `SEND_MESSAGE`.
3. Validar ponta a ponta com uma mensagem de teste: chegada no webhook, criação da mensagem na conta RR Holding, entrada na fila da Iris e resposta enviada.
4. Confirmar que a instância continua exclusiva da RR Holding (sem cruzar dados com DRM/Directconstru).

## Prevenção (para não repetir)

- Fazer a verificação de status da sessão (que já roda hoje) também checar o webhook da instância e **reaplicar automaticamente** quando estiver ausente/divergente.
- Registrar em log/alerta quando uma sessão estiver `connected` porém sem receber mensagens há mais de X horas em horário comercial, para detectar o problema antes do cliente reclamar.

## Detalhes técnicos

- Instância: `iris-de65f931-fa1d5082-28513b79`, servidor `loyalbat-evolution.cloudfy.live`, conta `de65f931-…`, sessão `84d3e09a-…`.
- Endpoints Evolution: `GET /webhook/find/{instance}` para diagnóstico e `POST /webhook/set/{instance}` para reaplicar.
- Ajuste de auto-reparo em `supabase/functions/whatsapp-session-status/index.ts`, reutilizando a lógica de configuração de webhook já existente em `whatsapp-session-connect`.

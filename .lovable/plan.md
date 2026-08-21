# Directconstru e RR Holding: diagnóstico e correção

## O que eu verifiquei agora (dados reais)

- **Sessões no banco**: as duas estão `connected`, sem `error_message`, checadas pelo monitor há poucos minutos.
- **Servidor Evolution** (`loyalbat`, compartilhado pelas duas contas): `directconstru` e `iris-de65f931-...` respondem `state: open`, e o webhook das duas aponta corretamente para `whatsapp-webhook` com `MESSAGES_UPSERT` habilitado.
- **Mas não entra mensagem**: última mensagem recebida de cliente na Directconstru foi **20/08 19:30 (Brasília)**; na RR Holding não há nenhuma mensagem de contato hoje — só duas mensagens digitadas por humano no painel.
- **Envio falhando na RR Holding**: duas mensagens manuais falharam após 3 tentativas — `Bad Request` (10:34) e `Internal Server Error` (19:06 UTC), com números de destino válidos.
- **Nos logs da função de webhook** só aparecem eventos `connection.update` da instância `proanimais`. Nenhum evento das instâncias da Directconstru e da RR Holding chega ao sistema.

Conclusão: o problema **não é** configuração no nosso lado (instância, webhook, RLS, IA). As duas instâncias estão "open" no papel, mas o socket do WhatsApp está morto/zumbi no servidor Evolution: não emitem eventos e recusam envios. Nosso monitor considera `open` = saudável, então nunca aciona recuperação.

## Correção proposta

1. **Recuperar as duas instâncias agora**
   - Executar um probe direto no servidor Evolution das duas instâncias (envio controlado de teste para um número da AXHolding) para confirmar se o socket responde.
   - Se confirmado zumbi, aplicar `restart` na instância (sem `logout`, para não exigir novo QR) e reaplicar o webhook em seguida.
   - Só pedir novo QR se o restart derrubar a autenticação.

2. **Detecção de "instância silenciosa" no monitor**
   - Além de `state`, passar a avaliar sinal de vida: última mensagem recebida, último evento de webhook e falhas recentes de envio da conta.
   - Se a instância estiver `open` porém sem nenhum evento por X horas (em horário comercial) ou com N falhas seguidas de envio, tratar como degradada.
   - Ação automática escalonada: reaplicar webhook → `restart` da instância → marcar `degraded` e registrar motivo se o restart não resolver.

3. **Tratar falhas de envio como sinal**
   - Registrar no `send_queue` o corpo do erro devolvido pela Evolution (hoje só grava "Bad Request"/"Internal Server Error").
   - Após 3 falhas de conexão numa mesma sessão, disparar a verificação/recuperação da instância e reenfileirar as mensagens quando voltar.

4. **Visibilidade para você**
   - Marcar a sessão como "Conectada, mas sem tráfego" no painel quando degradada, em vez de mostrar verde.
   - Manter o log por conta com estado, último evento recebido e ação de recuperação aplicada.

5. **Validação ponta a ponta**
   - Após o restart, enviar uma mensagem de teste para cada instância, confirmar chegada no webhook, processamento pela IA e resposta.
   - Confirmar que nada cruzou entre contas.

## Detalhes técnicos

- Novo campo de saúde nas sessões (ex.: `last_inbound_event_at`, `health`) alimentado pelo `whatsapp-webhook` e pelo monitor.
- `evolution-session-monitor` passa a chamar `/instance/restart/{instance}` quando detectar instância `open` porém silenciosa, com limite de 1 restart por sessão por hora.
- `whatsapp-sender` passa a propagar o texto de erro da Evolution e a sinalizar falhas de conexão para o monitor.
- Nenhuma mudança em isolamento multi-tenant, prompts ou RLS.

## Decisão necessária

O restart da instância é seguro na maioria dos casos, mas em cenário raro a Evolution pode pedir novo QR Code. Confirme se posso aplicar restart automático nas instâncias degradadas ou se prefere que o sistema apenas alerte e você autorize caso a caso.

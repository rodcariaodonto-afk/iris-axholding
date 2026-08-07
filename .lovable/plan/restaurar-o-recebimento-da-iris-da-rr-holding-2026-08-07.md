# Restaurar o recebimento da Iris da RR Holding

## Diagnóstico confirmado

- A conta **R R HOLDING LTDA** está ativa, com Iris e resposta automática habilitadas.
- A última mensagem de cliente registrada foi em **06/08/2026 às 17:00 (Brasília)**; não entrou nenhuma mensagem nova depois disso.
- Não há chamadas recentes no webhook nem itens novos nas filas de processamento.
- A sessão WhatsApp da conta foi **excluída em 07/08/2026 às 15:42 (Brasília)**. Atualmente não existe nenhuma linha em `whatsapp_sessions` vinculada à RR Holding.
- A configuração antiga ainda referencia a instância Evolution exclusiva `rrholding`, mas sem a sessão cadastrada o sistema perde o vínculo operacional necessário para receber e rotear corretamente as mensagens.

## Correção

1. Recriar a sessão WhatsApp da RR Holding vinculada exclusivamente à instância `rrholding`, sem criar ou compartilhar instância com outra conta.
2. Consultar o estado real da instância no servidor Evolution:
   - Se estiver conectada, sincronizar número, status e horário da conexão.
   - Se a sessão externa tiver expirado, gerar um novo QR Code para reconexão.
3. Reconfigurar o webhook da instância para o endpoint `whatsapp-webhook`, incluindo o evento de novas mensagens.
4. Fazer um teste ponta a ponta com uma mensagem nova e confirmar:
   - chegada no webhook;
   - criação da mensagem na conta RR Holding;
   - entrada e conclusão na fila da Iris;
   - envio da resposta pelo WhatsApp.
5. Confirmar que nenhum dado ou sessão de outra conta foi associado à RR Holding.

## Resultado esperado

A instância volta a aparecer nas configurações da RR Holding e novas mensagens recebidas entram no chat da conta e são respondidas pela Iris quando a conversa estiver no modo IA.
# Estabilizar as conexões com a Evolution

## Diagnóstico confirmado agora

- **Directconstru** e **R R HOLDING** receberam eventos `connection.update: open` hoje às **16:34 (Brasília)** e estão registradas como conectadas.
- A conta **DRM REPRESENTAÇÕES** está suspensa; sua sessão permanece desconectada com erro `401` e não será tratada como cliente ativo.
- O auto-reparo do webhook já existe em `whatsapp-session-status`, mas essa função só é chamada quando um usuário abre/seleciona uma sessão em Configurações.
- Não existe cron de monitoramento das sessões Evolution. Portanto, se a Evolution reiniciar, perder o webhook ou ficar com estado divergente, o sistema não detecta nem corrige sozinho até alguém acessar a tela.

## Correção proposta

1. **Criar um monitor automático de sessões Evolution**
   - Executar no backend, sem depender de usuário logado ou da tela aberta.
   - Processar somente contas ativas e somente a instância exclusiva vinculada a cada conta.
   - Consultar o estado real de cada instância no servidor Evolution configurado para aquela conta.

2. **Aplicar auto-recuperação segura**
   - Se a instância estiver online, validar e reaplicar o webhook quando estiver ausente ou divergente.
   - Se estiver em transição, atualizar o status sem recriar a instância.
   - Se estiver desconectada mas a sessão Evolution ainda existir, solicitar reconexão à própria instância.
   - Se a autenticação do WhatsApp tiver sido perdida e exigir QR Code, registrar `qr_pending`; não criar outra instância nem compartilhar sessão entre contas.
   - Se o servidor/chave retornar `401`, registrar o erro específico sem sobrescrever dados de outro cliente.

3. **Agendar a verificação periódica**
   - Criar um cron para executar o monitor a cada 5 minutos, durante todos os dias e horários.
   - Evitar chamadas duplicadas e limitar o processamento para não aumentar desnecessariamente o consumo da nuvem.

4. **Fortalecer observabilidade e interface**
   - Registrar por conta/instância: estado consultado, servidor alcançável, webhook reparado, tentativa de reconexão e erro recebido.
   - Manter o status exibido na tela sincronizado com a última checagem automática, sem depender de o cliente clicar em “Verificar conexão real”.

5. **Validar ponta a ponta**
   - Confirmar o estado real de Directconstru e RR Holding após o monitor rodar.
   - Confirmar que os webhooks das duas instâncias apontam para este projeto e incluem `MESSAGES_UPSERT`.
   - Enviar uma mensagem de teste para cada instância e verificar entrada, processamento pela IA e resposta.
   - Confirmar que nenhuma instância, mensagem ou configuração cruzou entre contas.

## Detalhes técnicos

- Reaproveitar e centralizar a lógica já existente em `whatsapp-session-status`, evitando duas implementações diferentes de validação de webhook.
- O monitor usará credenciais de backend e filtrará `accounts.status = 'active'`, `provider = 'evolution'` e `account_id` em todas as operações.
- O cron chamará uma função interna protegida; webhooks públicos continuarão separados do monitor administrativo.

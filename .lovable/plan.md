## Problema

A sessão "teste" da conta **DRM REPRESENTAÇÕES** aparece como "Servidor Evolution inacessível" porque no banco (`whatsapp_account_settings`) a linha da DRM está com:

- `evolution_api_url = NULL`
- `evolution_api_key = NULL`

Ou seja, os campos "URL" e "API Key" do bloco **Servidor Evolution** ainda não foram salvos para essa conta (o `https://sua-evolution.com` que aparece na tela é só placeholder; os pontinhos no campo API Key são só a máscara do input vazio). Sem URL e chave, `whatsapp-session-connect` e `whatsapp-session-status` tentam falar com uma URL nula → resposta "inacessível".

Como você confirmou que a **DRM tem servidor Evolution próprio**, o plano é preencher as credenciais deles e conectar.

## Passo a passo

### 1. Coletar as credenciais da DRM
Você precisa de dois valores fornecidos pela DRM (ou pelo provedor Evolution deles):
- **URL do servidor Evolution** (algo como `https://xxxxxxx.cloudfy.live` — sem `/` no final, sem `/manager`, sem `/instance/...`)
- **API Key global** do servidor (chave `apikey` que a Evolution aceita no header)

### 2. Validar antes de salvar (eu faço)
Assim que você me passar URL + API Key (aqui no chat), eu:
1. Faço um `GET {url}/instance/fetchInstances` com o header `apikey` para confirmar que a URL responde e a chave é válida.
2. Se falhar, te digo exatamente o motivo (DNS, 401, 404, etc.) antes de gravar qualquer coisa.

### 3. Gravar em `whatsapp_account_settings` da DRM
Depois de validado, gravo os dois campos na linha da conta DRM (`upsert` por `account_id`). O front já lê essa tabela filtrada por `activeAccountId`, então vai aparecer preenchido pra eles.

### 4. Reconectar a sessão "teste"
- Se o `evolution_instance_name` atual (`drmapresentacoes`) já existir no servidor deles, o backend faz `connect` e retorna QR / conecta direto.
- Se não existir, o backend cria a instância e retorna QR.
- Configuro o webhook do Evolution apontando para `whatsapp-webhook` (o `whatsapp-session-connect` já faz isso automaticamente).

### 5. Confirmar
Você clica em **Conectar** → escaneia o QR (se aparecer) → clica em **Verificar conexão real** e o badge deve virar verde ("Conexão real: online").

## Alternativa se você não quiser me passar a chave no chat

Se preferir não colar a API Key aqui: eu não preciso gravar nada pelo backend. Basta você:
1. Preencher **URL** e **API Key** no bloco "Servidor Evolution" da tela (logado como DRM ou via impersonação).
2. Clicar **Salvar**.
3. Clicar **Conectar** na sessão "teste".

Se depois disso ainda der "inacessível", me avisa que eu pego os logs da `whatsapp-session-status` pra ver a resposta exata do servidor deles (timeout, 401, DNS, CORS de origem etc.).

## Detalhes técnicos

- Tabela alterada: `public.whatsapp_account_settings` (linha `account_id = <DRM>`), campos `evolution_api_url`, `evolution_api_key`.
- Nenhuma migration necessária.
- Nenhuma edge function alterada — o fluxo atual (`whatsapp-session-connect`, `whatsapp-session-status`) já funciona quando as credenciais existem (é o mesmo que roda para a AXHolding hoje).
- Nenhum arquivo do frontend alterado.

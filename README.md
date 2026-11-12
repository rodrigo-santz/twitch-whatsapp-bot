# Bot Twitch → WhatsApp usando GitHub Actions (grátis)

Monitora até 100 canais da Twitch a cada 5 minutos e envia aviso para **um grupo** de WhatsApp com **GitHub Actions (repositório público)** e o plano Developer gratuito da GREEN-API.

**Não usa seu PC como servidor.** A API do WhatsApp aqui é uma integração de terceiros, não oficial, que exige conectar uma conta e pode apresentar interrupções ou restrições. Use de preferência um número separado com consentimento do grupo.

**Atenção:** este projeto ENVIA os avisos mas **NÃO menciona todos**. Escrever `@all` como texto pela API não é suficiente para garantir uma menção real. A GREEN-API não documenta um recurso de marcação `@all` no método usado. Não anunciamos essa funcionalidade como implementada.

## 1. Criar repositório no GitHub

1. Entre em https://github.com/new e crie um repositório **PUBLIC** chamado `twitch-whatsapp-bot`.
2. Na página do repo, clique em **Add file → Upload files** e envie todos os arquivos e pastas deste ZIP (incluindo `.github` e `.state`). Pelo navegador, você pode arrastar a pasta já extraída; confira se os diretórios ocultos foram enviados. Outra opção é subir via Git.
3. Em `streamers.json`, coloque os canais a acompanhar. Ex.: `["santz_rj", "canal2"]`.

## 2. Criar credenciais Twitch

1. Entre em https://dev.twitch.tv/console/apps e registre um aplicativo.
2. Obtenha **Client ID** e **Client Secret**. Para um app simples, o Console pode pedir um redirect URL — use uma URL válida que você controle; o fluxo deste projeto usa client credentials e não redireciona usuários.
3. Nunca coloque o Secret no código ou em Issues públicas.

## 3. Criar uma instância grátis de envio para WhatsApp

1. Entre em https://green-api.com/ e crie uma instância **Developer (Free)**. O plano gratuito permite até 3 chats por mês, então um grupo cabe no limite.
2. Conecte um número dedicado pelo QR Code **no site da provedora** e não compartilhe o QR com outras pessoas.
3. Anote `idInstance`, `apiTokenInstance`, `apiUrl` (quando fornecida) e **ID do grupo** (formato `...@g.us`). O número conectado deve estar no grupo.
4. O envio de grupo é feito pelo método `sendMessage` da documentação https://green-api.com/en/docs/api/sending/SendMessage/ .

## 4. Configurar Secrets e variável

No repositório: **Settings → Secrets and variables → Actions**.

Em **Repository secrets**, adicione:

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `GREEN_API_ID_INSTANCE`
- `GREEN_API_TOKEN_INSTANCE`
- `WHATSAPP_GROUP_ID` — ID com `@g.us`
- `GREEN_API_URL` — URL base da instância (opcional; o padrão é `https://api.green-api.com`). Não inclua barra final ou caminho de API.

Em **Repository variables**, adicione:

- `ENABLE_SEND`: `false` para testes; altere para `true` **somente depois** de conferir o grupo e obter aprovação do grupo.

**Nunca** publique IDs ou tokens em mensagens, prints ou repositórios públicos. O ID do grupo também deve ficar em Secret.

## 5. Testar e ligar

1. Clique na aba **Actions** → **Monitorar lives Twitch -> WhatsApp** → **Run workflow**.
2. Confira o log. Com `ENABLE_SEND=false`, ele identifica lives, mas **não envia mensagens** nem altera o estado.
3. Quando tudo estiver certo, configure `ENABLE_SEND=true`.
4. Execute manualmente outra vez, com uma live já online, para testar. O primeiro aviso pode corresponder a uma live que já começou.

No GitHub, o arquivo `.state/live_state.json` é atualizado pelo próprio GitHub Actions para evitar avisos duplicados. A opção `permissions: contents: write` no workflow dá a permissão necessária em repositórios que aceitam esse padrão; se o push falhar, confira **Settings → Actions → General → Workflow permissions**.

## Avisos / limitações

- GitHub Actions `schedule` tem **mínimo de 5 minutos**, pode atrasar ou perder execuções, e em repos públicos sem atividade pode ser desabilitado após 60 dias.
- A marcação de todos no grupo **não está implementada**. A nova função `@all` do app do WhatsApp não é o mesmo que escrever essa sequência em texto via API.
- Os envios dependem do plano Developer da GREEN-API e de uma conexão válida com o WhatsApp; a provedora pode mudar condições.
- Evite spam e alertas muito frequentes. Avise os administradores e obtenha consentimento da comunidade.
- Repositórios públicos são gratuitos para executores padrão do GitHub; o projeto **não** guarda tokens no repositório.
- Se um envio for aceito mas houver falha antes de salvar o estado, uma live poderá ser avisada novamente.

Links: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule | https://docs.github.com/en/actions/concepts/billing-and-usage | https://green-api.com/en/docs/about-tariffs/ | https://faq.whatsapp.com/521835819370205/

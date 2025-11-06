# BotHLTV

🎮 CS2 Monitor Bot (OpenWA + PandaScore)

Um bot em Node.js que consulta partidas Counter-Strike (CS2/CS:GO) via PandaScore e envia notificações individuais por WhatsApp usando @open-wa/wa-automate. Permite ao usuário abrir um menu (jogos), listar partidas ao vivo / agendadas / finalizadas, e se inscrever para receber atualizações em tempo real de uma partida específica.

📌 Recursos principais

Menu interativo via WhatsApp (com comandos simples: jogos, 1, 2, 3, parar).

Busca de partidas via PandaScore (running / upcoming / past).

Notificações individuais para assinantes quando houver alteração de placar.

Obtenção do placar por game/map (endpoint /matches/{id}/games) para detalhes de rounds/maps.

Estrutura simples, fácil de estender para envio a Discord/Telegram, persistência em DB, etc.


🧩 Dependências (exatas para instalar)


Instalação rápida (comando único):

npm install axios @open-wa/wa-automate dotenv puppeteer


Explicação das dependências usadas no projeto:


axios — requisições HTTP à API PandaScore.

@open-wa/wa-automate — cliente para automação do WhatsApp Web (envio/recebimento de mensagens).

dotenv — gerenciar variáveis sensíveis em .env.

puppeteer — controlador de Chromium/Chrome usado pelo OpenWA (ou para automações diretas, se necessário).


Dependências úteis em desenvolvimento:

npm install --save-dev nodemon

nodemon — reinicia automaticamente em desenvolvimento.

⚙️ .env.example

Print do ENV no GIT

📁 Estrutura sugerida do repositório
/src
  index.js          # ponto de entrada (o arquivo que você enviou)
  /lib
    hltvService.js  # (opcional) separar fetchMatches/fetchMatchRounds
session/            # pasta criada automaticamente para sessão do open-wa
.env
package.json
README.md

▶️ Como executar

Clonar o repositório:

git clone https://github.com/Marcos5333/BotHltv/

Criar .env baseado no .env.example.

Iniciar:

node index.js
# ou em dev
npx nodemon index.js


Ao iniciar, será gerado/recuperado o QR code pelo OpenWA (se necessário). A sessão e dados ficam em session/.

✅ Boas práticas e pontos de atenção

Não comite o .env (adicione no .gitignore).

Verifique limites de uso / rate limits do PandaScore; implemente backoff/retries se usar frequentemente.

Use logs com níveis (ex.: winston) para produção.

Considere persistir userSubscriptions em banco (Mongo, SQLite) para sobrevivência ao reinício.

Trate erros e reconexões do OpenWA: implementar handlers em onStateChanged/recreate client se a sessão cair.

Sanitizar e validar from (número do WhatsApp) caso grave/mostre em logs.

🛠️ Sugestões de melhorias (prioritárias)

Persistência das inscrições (userSubscriptions) em banco para reinício sem perder assinaturas.

Exponha health-check / metrics (/health) para monitoramento.

Melhor tratamento de erros e retries ao chamar as APIs (axios interceptors com retry/backoff).

Rate-limiting local para evitar spam de mensagens e bateria de requisições ao PandaScore.

Melhor UX no menu: permitir voltar e info <número> para detalhes da partida.

Testes unitários para as funções utilitárias (compactTeam, safeDate, formatMatches).

🧾 Observações legais / de uso

Respeite os termos de uso do PandaScore e do WhatsApp. O uso de automações no WhatsApp segue regras específicas — use com responsabilidade e para contas que podem ser automatizadas.

🧑‍💻 Autor

Desenvolvido por Marcos Souza

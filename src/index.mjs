
import { readFile, writeFile } from 'node:fs/promises';
import { normalizeLogins, buildMessage, calculateAlerts } from './lib.mjs';

// ================================
// CONFIGURAÇÕES
// ================================

const stateFile = new URL('../.state/live_state.json', import.meta.url);
const streamersFile = new URL('../streamers.json', import.meta.url);

const env = process.env;
const enabled = env.ENABLE_SEND === 'true';

// Só permite o primeiro aviso de uma live
// dentro dos 20 minutos após seu início.
const MAX_NEW_LIVE_AGE_MS = 20 * 60 * 1000;

const logins = normalizeLogins(
  JSON.parse(await readFile(streamersFile, 'utf8'))
);

const clientId = env.TWITCH_CLIENT_ID;
const clientSecret = env.TWITCH_CLIENT_SECRET;

// ================================
// VALIDAÇÃO
// ================================

if (!clientId || !clientSecret) {
  throw new Error(
    'Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET nos Secrets do GitHub.'
  );
}

if (
  enabled &&
  (
    !env.GREEN_API_ID_INSTANCE ||
    !env.GREEN_API_TOKEN_INSTANCE ||
    !env.WHATSAPP_GROUP_ID
  )
) {
  throw new Error(
    'Configure GREEN_API_ID_INSTANCE, GREEN_API_TOKEN_INSTANCE e WHATSAPP_GROUP_ID.'
  );
}

if (
  enabled &&
  !/^[-0-9]+@g\.us$/.test(env.WHATSAPP_GROUP_ID || '')
) {
  throw new Error(
    'WHATSAPP_GROUP_ID inválido. O ID precisa terminar em @g.us.'
  );
}

// ================================
// REQUISIÇÕES HTTP
// ================================

async function request(url, options = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    ...options
  });

  if (!response.ok) {
    const detalhe = await response.text();

    throw new Error(
      `Erro HTTP ${response.status}: ${detalhe.slice(0, 1000)}`
    );
  }

  return response.json();
}

// ================================
// AUTENTICAÇÃO TWITCH
// ================================

async function twitchToken() {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  const result = await request(
    'https://id.twitch.tv/oauth2/token',
    {
      method: 'POST',
      body: params
    }
  );

  if (!result.access_token) {
    throw new Error('Twitch não retornou access_token.');
  }

  return result.access_token;
}

// ================================
// CONSULTAR LIVES
// ================================

async function twitchStreams(token) {
  const params = new URLSearchParams();

  for (const login of logins) {
    params.append('user_login', login);
  }

  const result = await request(
    `https://api.twitch.tv/helix/streams?${params}`,
    {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`
      }
    }
  );

  return result.data || [];
}

// ================================
// GREEN-API / WHATSAPP
// ================================

async function sendWhatsApp(stream) {
  const apiBase = (
    env.GREEN_API_URL || 'https://api.green-api.com'
  ).replace(/\/+$/, '');

  if (!/^https:\/\/[a-z0-9.-]+$/i.test(apiBase)) {
    throw new Error(
      'GREEN_API_URL precisa ser uma URL HTTPS válida, sem caminhos.'
    );
  }

  const url =
    `${apiBase}/waInstance` +
    `${encodeURIComponent(env.GREEN_API_ID_INSTANCE)}` +
    `/sendMessage/` +
    `${encodeURIComponent(env.GREEN_API_TOKEN_INSTANCE)}`;

  const reply = await request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chatId: env.WHATSAPP_GROUP_ID,
      message: buildMessage(stream),
      linkPreview: true
    })
  });

  if (!reply.idMessage) {
    throw new Error(
      'GREEN-API não confirmou a fila de envio.'
    );
  }

  return reply.idMessage;
}

// ================================
// CONTROLE DE LIVES ANTIGAS
// ================================

function isRecentLive(stream) {
  const startedAt = Date.parse(stream.started_at);
  const now = Date.now();

  if (!Number.isFinite(startedAt)) {
    return false;
  }

  const age = now - startedAt;

  return age >= -60000 && age <= MAX_NEW_LIVE_AGE_MS;
}

// ================================
// CARREGAR ESTADO
// ================================

const previousState = JSON.parse(
  await readFile(stateFile, 'utf8')
);

const streams = await twitchStreams(
  await twitchToken()
);

console.log('Canais cadastrados:', logins.join(', '));

console.log('Canais ao vivo encontrados pela Twitch:');

for (const stream of streams) {
  console.log(
    `- ${stream.user_login} | ` +
    `Início: ${stream.started_at} | ` +
    `ID: ${stream.id}`
  );
}

// ================================
// CALCULAR ALERTAS
// ================================

const { alerts, nextState } = calculateAlerts(
  previousState,
  streams,
  logins
);

console.log(
  `Canais: ${logins.length}. ` +
  `Ao vivo: ${streams.length}. ` +
  `Alertas calculados: ${alerts.length}.`
);

// ================================
// MODO TESTE
// ================================

if (!enabled) {
  console.log(
    'MODO TESTE: ENABLE_SEND não está definido como true.'
  );

  console.log(
    'Nenhuma mensagem enviada nem estado alterado.'
  );

  for (const alert of alerts) {
    console.log(
      `Live detectada: ${alert.user_login}`
    );
  }

  process.exit(0);
}

// ================================
// PREPARAR ESTADO
// ================================

const working = {
  ...previousState,

  __lastAlertAt: {
    ...(previousState.__lastAlertAt || {})
  },

  __ignoredStreams: {
    ...(previousState.__ignoredStreams || {})
  }
};

async function saveState() {
  await writeFile(
    stateFile,
    JSON.stringify(working, null, 2) + '\n'
  );
}

const alertLogins = new Set(
  alerts.map(stream =>
    stream.user_login.toLowerCase()
  )
);

// Atualiza canais offline e canais que
// não precisam de um novo aviso.
for (const login of logins) {
  const currentId = nextState[login]
    ? String(nextState[login])
    : null;

  if (!currentId) {
    delete working[login];
    delete working.__ignoredStreams[login];
    continue;
  }

  // Uma nova transmissão não deve herdar
  // o bloqueio de uma transmissão antiga.
  if (
    working.__ignoredStreams[login] &&
    working.__ignoredStreams[login] !== currentId
  ) {
    delete working.__ignoredStreams[login];
  }

  if (!alertLogins.has(login)) {
    working[login] = nextState[login];
  }
}

await saveState();

// ================================
// ENVIAR NOTIFICAÇÕES
// ================================

let sentCount = 0;
let ignoredCount = 0;

for (const stream of alerts) {
  const login = stream.user_login.toLowerCase();
  const streamId = String(stream.id);

  // Impede que uma transmissão antiga
  // ignorada seja enviada posteriormente.
  if (working.__ignoredStreams[login] === streamId) {
    console.log(
      `Aviso ignorado (live antiga): ${login}`
    );

    ignoredCount++;
    continue;
  }

  const alreadyTracked =
    String(previousState[login] || '') === streamId;

  // A restrição de 20 minutos vale apenas
  // para o primeiro aviso de uma live.
  // Lembretes já existentes continuam
  // seguindo as regras do lib.mjs.
  if (!alreadyTracked && !isRecentLive(stream)) {
    console.log(
      `Live antiga ignorada: ${login} | ` +
      `Início: ${stream.started_at}`
    );

    working[login] = streamId;
    working.__ignoredStreams[login] = streamId;

    await saveState();

    ignoredCount++;
    continue;
  }

  try {
    const messageId = await sendWhatsApp(stream);

    working[login] = streamId;
    working.__lastAlertAt[login] = Date.now();

    delete working.__ignoredStreams[login];

    await saveState();

    sentCount++;

    console.log(
      `Aviso enfileirado: ${login} | ` +
      `ID: ${messageId}`
    );
  } catch (error) {
    console.error(
      `Falha ao enviar aviso de ${login}: ${error.message}`
    );

    // Não registra uma mensagem rejeitada
    // pela API como enviada.
    throw error;
  }
}

// ================================
// FINALIZAÇÃO
// ================================

console.log('------------------------------');
console.log(`Mensagens enfileiradas: ${sentCount}`);
console.log(`Lives antigas ignoradas: ${ignoredCount}`);
console.log('Verificação concluída.');

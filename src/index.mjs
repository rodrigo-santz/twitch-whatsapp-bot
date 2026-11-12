import {readFile, writeFile} from 'node:fs/promises';
import {normalizeLogins, buildMessage, calculateAlerts} from './lib.mjs';

const root = new URL('../', import.meta.url);
const stateFile = new URL('../.state/live_state.json', import.meta.url);
const logins = normalizeLogins(JSON.parse(await readFile(new URL('../streamers.json', import.meta.url), 'utf8')));
const env = process.env;
const enabled = env.ENABLE_SEND === 'true';
const clientId = env.TWITCH_CLIENT_ID;
const clientSecret = env.TWITCH_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error('Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET nos Secrets do GitHub.');
if (enabled && (!env.GREEN_API_ID_INSTANCE || !env.GREEN_API_TOKEN_INSTANCE || !env.WHATSAPP_GROUP_ID)) {
  throw new Error('Para enviar, configure GREEN_API_ID_INSTANCE, GREEN_API_TOKEN_INSTANCE e WHATSAPP_GROUP_ID.');
}
if (enabled && !/^[-0-9]+@g\.us$/.test(env.WHATSAPP_GROUP_ID || '')) {
  throw new Error('WHATSAPP_GROUP_ID deve terminar em @g.us (veja o ID no painel da GREEN-API).');
}

async function request(url, options = {}) {
  const response = await fetch(url, {signal: AbortSignal.timeout(20000), ...options});
  if (!response.ok) throw new Error(`Erro HTTP ${response.status} na integração externa.`);
  return response.json();
}

async function twitchToken() {
  const params = new URLSearchParams({client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials'});
  const token = await request('https://id.twitch.tv/oauth2/token', {method: 'POST', body: params});
  if (!token.access_token) throw new Error('Twitch não retornou access_token.');
  return token.access_token;
}

async function twitchStreams(token) {
  const params = new URLSearchParams();
  for (const login of logins) params.append('user_login', login);
  const result = await request(`https://api.twitch.tv/helix/streams?${params}`, {
    headers: {'Client-ID': clientId, Authorization: `Bearer ${token}`}
  });
  return result.data || [];
}

async function sendWhatsApp(stream) {
  const apiBase = (env.GREEN_API_URL || 'https://api.green-api.com').replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(apiBase)) throw new Error('GREEN_API_URL precisa ser uma URL HTTPS válida, sem caminhos.');
  const url = `${apiBase}/waInstance${encodeURIComponent(env.GREEN_API_ID_INSTANCE)}/sendMessage/${encodeURIComponent(env.GREEN_API_TOKEN_INSTANCE)}`;
  const reply = await request(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({chatId: env.WHATSAPP_GROUP_ID, message: buildMessage(stream), linkPreview: true})
  });
  if (!reply.idMessage) throw new Error('GREEN-API não confirmou a fila de envio.');
}

const previousState = JSON.parse(await readFile(stateFile, 'utf8'));
const streams = await twitchStreams(await twitchToken());
const {alerts, nextState} = calculateAlerts(previousState, streams, logins);
console.log(`Canais: ${logins.length}. Ao vivo: ${streams.length}. Novas transmissões: ${alerts.length}.`);
if (!enabled) {
  console.log('MODO TESTE: ENABLE_SEND não está definido como true. Nenhuma mensagem enviada nem estado alterado.');
  for (const alert of alerts) console.log(`Live detectada: ${alert.user_login}`);
  process.exit(0);
}

// Salva o estado depois de cada envio bem-sucedido para minimizar reenvios em caso de falha parcial.
const working = {...previousState};
for (const login of logins) {
  if (!nextState[login]) delete working[login]; // canal atualmente offline
}
await writeFile(stateFile, JSON.stringify(working, null, 2) + '\n');
for (const stream of alerts) {
  await sendWhatsApp(stream);
  working[stream.user_login.toLowerCase()] = String(stream.id);
  await writeFile(stateFile, JSON.stringify(working, null, 2) + '\n');
  console.log(`Aviso enfileirado: ${stream.user_login}`);
}
console.log('Verificação concluída.');

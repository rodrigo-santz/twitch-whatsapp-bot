export function normalizeLogins(raw) {
  if (!Array.isArray(raw)) throw new Error('streamers.json precisa ser um array de nomes.');
  const list = [...new Set(raw.map(x => String(x).trim().replace(/^@/, '').toLowerCase()).filter(Boolean))];
  if (list.length === 0 || list.length > 100) throw new Error('Configure entre 1 e 100 canais no streamers.json.');
  if (list.some(x => !/^[a-z0-9_]{4,25}$/.test(x))) throw new Error('Há nomes de canais inválidos em streamers.json.');
  return list;
}


export function buildMessage(stream) {
  const channel = stream.user_login;
  const name = stream.user_name || channel;

  return `🔴 *LIVE ON - ${name}*

https://www.twitch.tv/${encodeURIComponent(channel)}

Bora fortalecer a comunidade!`;
}


// Um aviso por streamer a cada 60 minutos, mesmo quando a live cai e volta.
export const ALERT_COOLDOWN_MS = 60 * 60 * 1000;
export function calculateAlerts(previousState, streams, monitored, nowMs = Date.now()) {
  const active = new Map(streams.map(s => [s.user_login.toLowerCase(), s]));
  const lastSentAt = previousState.__lastAlertAt || {};
  const nextState = {};
  const alerts = [];
  for (const login of monitored) {
    const live = active.get(login);
    if (!live) continue;
    const id = String(live.id);
    nextState[login] = id;

    const last = Number(lastSentAt[login]) || 0;
    const withinCooldown = last > 0 && nowMs - last < ALERT_COOLDOWN_MS;
    if (previousState[login] !== id && !withinCooldown) alerts.push(live);
  }
  return {alerts, nextState};
}

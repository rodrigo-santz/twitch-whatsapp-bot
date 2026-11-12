export function normalizeLogins(raw) {
  if (!Array.isArray(raw)) throw new Error('streamers.json precisa ser um array de nomes.');
  const list = [...new Set(raw.map(x => String(x).trim().replace(/^@/, '').toLowerCase()).filter(Boolean))];
  if (list.length === 0 || list.length > 100) throw new Error('Configure entre 1 e 100 canais no streamers.json.');
  if (list.some(x => !/^[a-z0-9_]{4,25}$/.test(x))) throw new Error('Há nomes de canais inválidos em streamers.json.');
  return list;
}

export function buildMessage(stream) {
  const channel = stream.user_login;
  const game = stream.game_name || 'Categoria não informada';
  const title = stream.title || 'Live iniciada';
  return `🔴 *LIVE ON — ${stream.user_name || channel}*\n\n🎮 *Categoria:* ${game}\n📣 *Título:* ${title}\n🔗 https://www.twitch.tv/${encodeURIComponent(channel)}\n\nBora fortalecer a comunidade!`;
}

// Retorna os avisos apenas para transmissões ainda não notificadas e o novo estado.
export function calculateAlerts(previousState, streams, monitored) {
  const active = new Map(streams.map(s => [s.user_login.toLowerCase(), s]));
  const nextState = {};
  const alerts = [];
  for (const login of monitored) {
    const live = active.get(login);
    if (!live) continue;
    const id = String(live.id);
    nextState[login] = id;
    if (previousState[login] !== id) alerts.push(live);
  }
  return {alerts, nextState};
}

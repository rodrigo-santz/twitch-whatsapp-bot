import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {normalizeLogins, buildMessage, calculateAlerts} from '../src/lib.mjs';

test('normaliza logins repetidos', () => assert.deepEqual(normalizeLogins(['@Santz_RJ', 'santz_rj', 'OUTRO_123']), ['santz_rj', 'outro_123']));
test('envia apenas para lives novas', () => {
 const a = {user_login:'santz_rj', id:'111', title:'Teste'};
 assert.equal(calculateAlerts({}, [a], ['santz_rj']).alerts.length, 1);
 assert.equal(calculateAlerts({santz_rj:'111'}, [a], ['santz_rj']).alerts.length, 0);
 assert.equal(calculateAlerts({santz_rj:'111'}, [{...a,id:'222'}], ['santz_rj']).alerts.length, 1);
});
test('remove offline do estado', () => assert.deepEqual(calculateAlerts({santz_rj:'111'}, [], ['santz_rj']).nextState, {}));
test('monta link de live', () => assert.match(buildMessage({user_login:'santz_rj',user_name:'Santz', game_name:'LoL'}), /https:\/\/www.twitch.tv\/santz_rj/));

test('impede avisos em novas sessões dentro de uma hora', () => {
 const now = Date.parse('2026-11-20T10:00:00Z');
 const live = {user_login:'santz_rj', id:'222'};
 const prev = {santz_rj:'111', __lastAlertAt:{santz_rj:now}};
 assert.equal(calculateAlerts(prev, [live], ['santz_rj'], now+59*60*1000).alerts.length, 0);
 assert.equal(calculateAlerts(prev, [live], ['santz_rj'], now+60*60*1000).alerts.length, 1);
});
test('nunca reenviar a mesma sessão só por completar uma hora', () => {
 const now = Date.parse('2026-11-20T10:00:00Z');
 const prev = {santz_rj:'222', __lastAlertAt:{santz_rj:now}};
 assert.equal(calculateAlerts(prev, [{user_login:'santz_rj',id:'222'}], ['santz_rj'], now+80*60*1000).alerts.length, 0);
});

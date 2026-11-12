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

import test from 'node:test';
import assert from 'node:assert/strict';
import { createListeningPartyClient } from './listeningPartyClient.js';

const episodeId = '507f1f77bcf86cd799439011';
function harness() {
  const handlers = new Map();
  const emitted = [];
  const statuses = [];
  const messages = [];
  const syncs = [];
  let options;
  let currentToken = 'first-token';
  const socket = { id: 'device-a', connected: false, connections: 0,
    on: (event, handler) => handlers.set(event, handler),
    emit: (event, payload, ack) => emitted.push({ event, payload, ack }),
    connect() { this.connections++; },
    disconnect() { this.connected = false; handlers.get('disconnect')?.(); },
    removeAllListeners: () => handlers.clear(),
    fire(event, data) { if (event === 'connect') this.connected = true; handlers.get(event)?.(data); },
  };
  const client = createListeningPartyClient({ episodeId, backendUrl: 'https://library.example',
    makeSocket: (_url, opts) => { options = opts; return socket; }, getAccessToken: async () => currentToken,
    onStatus: status => statuses.push(status), onMessage: message => messages.push(message), onSync: (...args) => syncs.push(args) });
  const join = () => {
    socket.fire('connect');
    emitted.at(-1).ack({ success: true });
  };
  return { client, socket, emitted, statuses, messages, syncs, options, join,
    setToken: value => { currentToken = value; } };
}

test('fetches the latest token for each handshake and joins only after connection', async () => {
  const { socket, emitted, options, setToken, client } = harness();
  const authenticate = () => new Promise(resolve => options.auth(resolve));
  assert.deepEqual(await authenticate(), { token: 'first-token' });
  assert.equal(emitted.length, 0);
  socket.fire('connect');
  assert.equal(emitted[0].event, 'join-room');
  assert.deepEqual(emitted[0].payload, { roomId: episodeId });
  setToken('refreshed-token');
  client.refreshSession();
  assert.deepEqual(await authenticate(), { token: 'refreshed-token' });
  socket.fire('connect');
  assert.equal(emitted.filter(value => value.event === 'join-room').length, 2);
});

test('only a joined host sends playback controls and no client identity is supplied', () => {
  const { client, socket, emitted, join } = harness();
  assert.equal(client.sendControl('sync-play', 1), false);
  join();
  assert.equal(client.sendControl('sync-play', 1), false);
  socket.fire('room-state', { roomId: episodeId, hostSocketId: socket.id, listenerCount: 1 });
  assert.equal(client.sendControl('sync-play', 1), true);
  assert.deepEqual(emitted.at(-1).payload, { roomId: episodeId, currentTime: 1 });
  assert.equal(client.sendControl('arbitrary-event', 1), false);
  assert.equal(client.sendControl('sync-seek', Infinity), false);
});

test('only displays accepted outgoing messages and reports rejected actions', () => {
  const { client, join, emitted, messages, statuses } = harness();
  let accepted = 0;
  join();
  assert.equal(client.sendMessage('Hello', () => { accepted++; }), true);
  assert.equal(messages.length, 0);
  assert.equal(accepted, 0);
  emitted.at(-1).ack({ success: false, message: 'Rate limited' });
  assert.equal(messages.length, 0);
  assert.equal(statuses.at(-1).error, 'Rate limited');
  client.sendMessage('Hello', () => { accepted++; });
  emitted.at(-1).ack({ success: true, message: { username: 'Server Owner', message: 'Hello' } });
  assert.deepEqual(messages[0], { username: 'Server Owner', message: 'Hello', self: true });
  assert.equal(accepted, 1);
  assert.equal(client.sendMessage('x'.repeat(1001)), false);
});

test('ignores events for a previous room and malformed synchronization positions', () => {
  const { socket, join, messages, syncs } = harness();
  join();
  socket.fire('receive-message', { roomId: 'old-room', message: 'Old data' });
  socket.fire('sync-play', { roomId: episodeId, currentTime: NaN });
  socket.fire('sync-seek', { roomId: 'old-room', currentTime: 10 });
  assert.equal(messages.length, 0);
  assert.equal(syncs.length, 0);
  socket.fire('sync-play', { roomId: episodeId, currentTime: 10 });
  assert.equal(syncs.length, 1);
});

test('disconnect and cleanup stop emission, clear listeners and ignore late acknowledgements', () => {
  const { socket, join, client, emitted, messages } = harness();
  join();
  client.sendMessage('In flight');
  const ack = emitted.at(-1).ack;
  client.close();
  ack({ success: true, message: { message: 'Late' } });
  assert.equal(messages.length, 0);
  assert.equal(client.sendControl('sync-play', 10), false);
  assert.equal(client.sendMessage('After logout'), false);
  assert.equal(socket.connected, false);
  const count = socket.connections;
  client.reconnect();
  assert.equal(socket.connections, count);
});

test('late join acknowledgements from an old connection cannot authorize the new connection', () => {
  const { socket, emitted, client } = harness();
  socket.fire('connect');
  const oldAck = emitted.at(-1).ack;
  client.refreshSession();
  socket.fire('connect');
  oldAck({ success: true });
  assert.equal(client.sendMessage('Not joined yet'), false);
  emitted.at(-1).ack({ success: true });
  assert.equal(client.sendMessage('Joined now'), true);
});

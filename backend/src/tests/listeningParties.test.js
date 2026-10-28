const { attachListeningParties } = require('../realtime/listeningParties');

const episodeId = '507f1f77bcf86cd799439011';
const otherEpisodeId = '507f191e810c19729de860ea';
function harness() {
  let time = 0;
  const broadcasts = [];
  const timers = [];
  let connectionHandler;
  let middleware;
  const rooms = new Map();
  const io = {
    sockets: { adapter: { rooms } },
    use: handler => { middleware = handler; },
    on: (_event, handler) => { connectionHandler = handler; },
    to: room => ({ emit: (event, payload) => broadcasts.push({ room, event, payload }) }),
  };
  const authenticate = jest.fn(async token => {
    if (token !== 'owner-token') throw new Error('Owner access required');
    return { user: { _id: 'owner', name: 'Server Owner', avatar: '' }, expiresAt: 3600000 };
  });
  const findEpisode = jest.fn(async id => id === episodeId || id === otherEpisodeId ? { duration: 120 } : null);
  attachListeningParties(io, { authenticate, findEpisode, now: () => time,
    setTimeoutFn: (callback, delay) => { const timer = { callback, delay, unref() {} }; timers.push(timer); return timer; }, clearTimeoutFn: jest.fn() });
  const connect = async (id, token = 'owner-token') => {
    const handlers = new Map();
    const sent = [];
    const socket = {
      id, handshake: { auth: { token } }, data: {}, connected: false, rooms: new Set([id]), sent,
      on: (event, handler) => handlers.set(event, handler),
      emit: (event, payload) => sent.push({ event, payload }),
      to: room => ({ emit: (event, payload) => broadcasts.push({ room, event, payload, except: id }) }),
      join: async room => { if (!rooms.has(room)) rooms.set(room, new Set()); rooms.get(room).add(id); socket.rooms.add(room); },
      leave: async room => { rooms.get(room)?.delete(id); socket.rooms.delete(room); },
      disconnect: () => {
        handlers.get('disconnecting')?.();
        for (const room of socket.rooms) rooms.get(room)?.delete(id);
        socket.rooms.clear(); socket.connected = false;
        handlers.get('disconnect')?.();
      },
      receive: (event, payload) => new Promise(resolve => handlers.get(event)(payload, resolve)),
    };
    await new Promise((resolve, reject) => middleware(socket, error => error ? reject(error) : resolve()));
    socket.connected = true;
    connectionHandler(socket);
    return socket;
  };
  return { connect, broadcasts, authenticate, findEpisode, timers, advance: ms => { time += ms; } };
}

test('rejects guests and non-owner sessions before creating a room connection', async () => {
  const { connect } = harness();
  await expect(connect('guest', '')).rejects.toThrow('Owner sign-in');
  await expect(connect('other', 'another-account-token')).rejects.toThrow('Owner sign-in');
});

test('checks episode existence before joining and ignores client-supplied identity', async () => {
  const { connect, broadcasts, findEpisode } = harness();
  const socket = await connect('device-a');
  expect((await socket.receive('join-room', { roomId: 'not-an-id' })).code).toBe('INVALID_ROOM');
  expect(findEpisode).not.toHaveBeenCalled();
  expect((await socket.receive('join-room', { roomId: 'aaaaaaaaaaaaaaaaaaaaaaaa' })).code).toBe('NOT_FOUND');
  expect((await socket.receive('join-room', { roomId: episodeId, username: 'Impersonated' })).success).toBe(true);
  expect(broadcasts.find(item => item.event === 'user-joined').payload.username).toBe('Server Owner');
});

test('rejects playback and chat outside joined rooms', async () => {
  const { connect } = harness();
  const socket = await connect('device-a');
  expect((await socket.receive('sync-play', { roomId: episodeId, currentTime: 1 })).code).toBe('NOT_IN_ROOM');
  await socket.receive('join-room', { roomId: episodeId });
  expect((await socket.receive('send-message', { roomId: otherEpisodeId, message: 'Wrong room' })).code).toBe('NOT_IN_ROOM');
});

test('enforces host-only sync and allows an owner device to explicitly take control', async () => {
  const { connect, broadcasts } = harness();
  const first = await connect('device-a');
  const second = await connect('device-b');
  await first.receive('join-room', { roomId: episodeId });
  await second.receive('join-room', { roomId: episodeId });
  expect((await second.receive('sync-play', { roomId: episodeId, currentTime: 10 })).code).toBe('HOST_REQUIRED');
  expect((await second.receive('claim-host', { roomId: episodeId })).success).toBe(true);
  expect((await second.receive('sync-play', { roomId: episodeId, currentTime: 10, username: 'Spoofed' })).success).toBe(true);
  expect((await first.receive('sync-pause', { roomId: episodeId, currentTime: 10 })).code).toBe('HOST_REQUIRED');
  expect(broadcasts.find(item => item.event === 'sync-play').payload.username).toBe('Server Owner');
});

test.each([-1, NaN, Infinity, 121, '20'])('rejects invalid playback positions: %s', async currentTime => {
  const { connect } = harness();
  const socket = await connect('device-a');
  await socket.receive('join-room', { roomId: episodeId });
  expect((await socket.receive('sync-seek', { roomId: episodeId, currentTime })).code).toBe('INVALID_POSITION');
});

test('validates chat length and returns only server-derived identity', async () => {
  const { connect } = harness();
  const socket = await connect('device-a');
  await socket.receive('join-room', { roomId: episodeId });
  for (const message of ['', '   ', 'x'.repeat(1001), null]) {
    expect((await socket.receive('send-message', { roomId: episodeId, message })).code).toBe('INVALID_MESSAGE');
  }
  const response = await socket.receive('send-message', { roomId: episodeId, message: ' Hello ', username: 'Spoofed', avatar: 'untrusted' });
  expect(response.message).toMatchObject({ username: 'Server Owner', avatar: '', message: 'Hello', roomId: episodeId });
});

test('limits chat events across all connections belonging to the same owner', async () => {
  const { connect, advance } = harness();
  const first = await connect('device-a');
  const second = await connect('device-b');
  await first.receive('join-room', { roomId: episodeId });
  await second.receive('join-room', { roomId: episodeId });
  for (let index = 0; index < 30; index++) {
    expect((await (index % 2 ? first : second).receive('send-message', { roomId: episodeId, message: 'Hello' })).success).toBe(true);
  }
  expect((await second.receive('send-message', { roomId: episodeId, message: 'Excess' })).code).toBe('RATE_LIMIT');
  advance(60001);
  expect((await first.receive('send-message', { roomId: episodeId, message: 'Allowed again' })).success).toBe(true);
});

test('elects the remaining host and publishes the actual room member count on disconnect', async () => {
  const { connect, broadcasts } = harness();
  const first = await connect('device-a');
  const second = await connect('device-b');
  await first.receive('join-room', { roomId: episodeId });
  await second.receive('join-room', { roomId: episodeId });
  first.disconnect();
  expect(broadcasts.filter(item => item.event === 'room-state').at(-1).payload).toMatchObject({ hostSocketId: 'device-b', listenerCount: 1 });
  expect((await second.receive('sync-play', { roomId: episodeId, currentTime: 1 })).success).toBe(true);
});

test('limits join and playback-control floods independently', async () => {
  const { connect } = harness();
  const socket = await connect('device-a');
  for (let index = 0; index < 10; index++) expect((await socket.receive('join-room', { roomId: episodeId })).success).toBe(true);
  expect((await socket.receive('join-room', { roomId: episodeId })).code).toBe('RATE_LIMIT');
  for (let index = 0; index < 120; index++) expect((await socket.receive('sync-seek', { roomId: episodeId, currentTime: 5 })).success).toBe(true);
  expect((await socket.receive('sync-seek', { roomId: episodeId, currentTime: 5 })).code).toBe('RATE_LIMIT');
});

test('disconnects expired or newly invalidated owner sessions', async () => {
  const { connect, authenticate, advance, timers } = harness();
  const socket = await connect('device-a');
  await socket.receive('join-room', { roomId: episodeId });
  authenticate.mockRejectedValueOnce(new Error('Suspended'));
  expect((await socket.receive('send-message', { roomId: episodeId, message: 'Hello' })).code).toBe('AUTH_REQUIRED');
  expect(socket.connected).toBe(false);
  const other = await connect('device-b');
  advance(3600001);
  expect((await other.receive('join-room', { roomId: episodeId })).code).toBe('AUTH_REQUIRED');
  expect(other.connected).toBe(false);
  const last = harness();
  const expiring = await last.connect('device-c');
  last.timers[0].callback();
  expect(expiring.sent.at(-1).event).toBe('session-expired');
  expect(expiring.connected).toBe(false);
  expect(timers[0].delay).toBe(3600000);
});

test('moving rooms removes old membership and malformed packets do not crash a connection', async () => {
  const { connect } = harness();
  const socket = await connect('device-a');
  expect((await socket.receive('join-room', null)).code).toBe('INVALID_PAYLOAD');
  await socket.receive('join-room', { roomId: episodeId });
  await socket.receive('join-room', { roomId: otherEpisodeId });
  expect(socket.rooms.has(`episode:${episodeId}`)).toBe(false);
  expect(socket.rooms.has(`episode:${otherEpisodeId}`)).toBe(true);
});

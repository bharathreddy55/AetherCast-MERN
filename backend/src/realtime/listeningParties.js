const Episode = require('../models/Episode');
const { authenticateOwnerToken } = require('../middlewares/auth');
const { createMediaLink } = require('../utils/mediaLinks');

const roomName = id => `episode:${id}`;
const validRoom = id => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
const failure = (code, message) => Object.assign(new Error(message), { code });

function attachListeningParties(io, {
  authenticate = authenticateOwnerToken,
  findEpisode = id => Episode.findById(id).select('duration').lean().maxTimeMS(5000),
  now = Date.now, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout,
} = {}) {
  const hosts = new Map();
  const budgets = new Map();
  const consume = (ownerId, group) => {
    const key = `${ownerId}:${group}`;
    const limit = { join: 10, control: 120, chat: 30 }[group];
    let entry = budgets.get(key);
    if (!entry || now() >= entry.reset) { entry = { count: 0, reset: now() + 60000 }; budgets.set(key, entry); }
    if (++entry.count > limit) throw failure('RATE_LIMIT', 'Too many room events. Wait a minute and try again.');
  };
  const publishState = (id, leavingId) => {
    const members = [...(io.sockets.adapter.rooms.get(roomName(id)) || [])].filter(value => value !== leavingId);
    if (!members.length) hosts.delete(id);
    else if (!members.includes(hosts.get(id))) hosts.set(id, members[0]);
    io.to(roomName(id)).emit('room-state', { roomId: id, listenerCount: members.length, hostSocketId: hosts.get(id) || null });
  };

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const session = await authenticate(token);
      if (!Number.isFinite(session.expiresAt) || session.expiresAt <= now()) throw new Error('Expired');
      socket.data.ownerSession = { ...session, token };
      next();
    } catch {
      const error = new Error('Owner sign-in is required for listening rooms.');
      error.data = { code: 'AUTH_REQUIRED' };
      next(error);
    }
  });

  io.on('connection', socket => {
    let currentRoom = null;
    let episodeDuration = 0;
    let queue = Promise.resolve();
    const session = socket.data.ownerSession;
    const expiryTimer = setTimeoutFn(() => {
      socket.emit('session-expired', { message: 'Your room session expired. Reconnect to continue.' });
      socket.disconnect(true);
    }, Math.min(session.expiresAt - now(), 2147483647));
    expiryTimer?.unref?.();
    const replyError = (ack, error) => {
      const result = { success: false, code: error.code || 'ROOM_ERROR',
        message: error.code ? error.message : 'Unable to process this room action.' };
      if (typeof ack === 'function') ack(result);
      else socket.emit('party-error', result);
    };
    const identity = () => {
      let avatar = '';
      try { avatar = createMediaLink(socket.data.ownerSession.user.avatar || ''); } catch { /* Invalid legacy artwork must not break room cleanup. */ }
      return { username: socket.data.ownerSession.user.name || 'Owner', avatar };
    };
    const requireMembership = payload => {
      if (!validRoom(payload.roomId) || payload.roomId !== currentRoom || !socket.rooms.has(roomName(currentRoom))) {
        throw failure('NOT_IN_ROOM', 'Join this episode room before sending events.');
      }
    };
    const leave = async () => {
      if (!currentRoom) return;
      const previous = currentRoom;
      currentRoom = null;
      await socket.leave(roomName(previous));
      socket.to(roomName(previous)).emit('user-left', { roomId: previous, username: identity().username, socketId: socket.id });
      publishState(previous);
    };
    const register = (event, group, handler) => socket.on(event, (payload, ack) => {
      try {
        consume(String(session.user._id), group);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw failure('INVALID_PAYLOAD', 'Invalid room event.');
      } catch (error) { replyError(ack, error); return; }
      queue = queue.then(async () => {
        if (!socket.connected) return;
        try {
          if (session.expiresAt <= now()) throw new Error('Expired');
          socket.data.ownerSession = { ...await authenticate(session.token), token: session.token };
          if (!socket.connected) return;
        } catch {
          replyError(ack, failure('AUTH_REQUIRED', 'Your owner session is no longer valid.'));
          socket.disconnect(true);
          return;
        }
        const result = await handler(payload);
        if (typeof ack === 'function') ack({ success: true, ...result });
      }).catch(error => replyError(ack, error));
    });

    register('join-room', 'join', async payload => {
      if (!validRoom(payload.roomId)) throw failure('INVALID_ROOM', 'Choose a valid episode room.');
      const episode = await findEpisode(payload.roomId);
      if (!episode) throw failure('NOT_FOUND', 'This episode is unavailable.');
      if (!socket.connected) return;
      if (payload.roomId !== currentRoom) {
        await leave();
        if (!socket.connected) return;
        currentRoom = payload.roomId;
        episodeDuration = episode.duration;
        await socket.join(roomName(currentRoom));
        if (!socket.connected) { await socket.leave(roomName(currentRoom)); currentRoom = null; return; }
        socket.to(roomName(currentRoom)).emit('user-joined', { roomId: currentRoom, username: identity().username, socketId: socket.id });
      }
      publishState(currentRoom);
    });
    register('leave-room', 'join', async payload => { requireMembership(payload); await leave(); });
    register('claim-host', 'control', async payload => {
      requireMembership(payload);
      hosts.set(currentRoom, socket.id);
      publishState(currentRoom);
    });
    for (const event of ['sync-play', 'sync-pause', 'sync-seek']) register(event, 'control', async payload => {
      requireMembership(payload);
      if (hosts.get(currentRoom) !== socket.id) throw failure('HOST_REQUIRED', 'Only the current host can sync playback. Take control first.');
      const limit = Number.isFinite(episodeDuration) && episodeDuration > 0 ? episodeDuration : 86400;
      if (!Number.isFinite(payload.currentTime) || payload.currentTime < 0 || payload.currentTime > limit) {
        throw failure('INVALID_POSITION', 'Playback position is outside this episode.');
      }
      socket.to(roomName(currentRoom)).emit(event, { roomId: currentRoom, username: identity().username, currentTime: payload.currentTime });
    });
    register('send-message', 'chat', async payload => {
      requireMembership(payload);
      if (typeof payload.message !== 'string' || !payload.message.trim() || payload.message.length > 1000) {
        throw failure('INVALID_MESSAGE', 'Messages must contain between 1 and 1000 characters.');
      }
      const message = { roomId: currentRoom, ...identity(), message: payload.message.trim(), timestamp: new Date(now()).toISOString() };
      socket.to(roomName(currentRoom)).emit('receive-message', message);
      return { message };
    });
    socket.on('disconnecting', () => {
      if (currentRoom) {
        socket.to(roomName(currentRoom)).emit('user-left', { roomId: currentRoom, username: identity().username, socketId: socket.id });
        publishState(currentRoom, socket.id);
        currentRoom = null;
      }
    });
    socket.on('disconnect', () => clearTimeoutFn(expiryTimer));
  });
}

module.exports = { attachListeningParties };

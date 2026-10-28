export function createListeningPartyClient({ makeSocket, backendUrl, episodeId, getAccessToken,
  onStatus = () => {}, onRoomState = () => {}, onMessage = () => {}, onSync = () => {} }) {
  let closed = false;
  let joined = false;
  let host = false;
  let generation = 0;
  const socket = makeSocket(backendUrl, { autoConnect: false, withCredentials: true,
    auth: callback => {
      Promise.resolve().then(getAccessToken).then(token => {
        if (!closed) callback(token ? { token } : {});
      }).catch(() => { if (!closed) callback({}); });
    },
  });
  const report = error => { if (!closed) onStatus({ connected: socket.connected, joined, error: error || '' }); };
  const acknowledge = result => {
    if (!closed && !result?.success) report(result?.message || 'The room action could not be completed.');
  };
  socket.on('connect', () => {
    const currentGeneration = ++generation;
    joined = false;
    host = false;
    report();
    socket.emit('join-room', { roomId: episodeId }, result => {
      if (closed || currentGeneration !== generation) return;
      joined = !!result?.success;
      if (joined) report(); else acknowledge(result);
    });
  });
  socket.on('room-state', state => {
    if (closed || !state || state.roomId !== episodeId) return;
    host = state.hostSocketId === socket.id;
    onRoomState({ listenerCount: state.listenerCount, isHost: host });
  });
  socket.on('receive-message', message => {
    if (!closed && message?.roomId === episodeId) onMessage({ ...message, self: false });
  });
  for (const event of ['sync-play', 'sync-pause', 'sync-seek']) socket.on(event, payload => {
    if (!closed && joined && payload?.roomId === episodeId && Number.isFinite(payload.currentTime) && payload.currentTime >= 0) onSync(event, payload);
  });
  socket.on('party-error', error => report(error.message || 'Room action rejected.'));
  socket.on('session-expired', error => { joined = false; host = false; report(error.message); });
  socket.on('connect_error', () => { joined = false; host = false; report('Unable to connect. Sign in as the owner, then retry.'); });
  socket.on('disconnect', () => { ++generation; joined = false; host = false; onRoomState({ listenerCount: 0, isHost: false }); report('Room disconnected. Reconnect to continue.'); });
  socket.connect();
  return {
    reconnect() { if (!closed && !socket.connected) socket.connect(); },
    refreshSession() { if (!closed) { socket.disconnect(); socket.connect(); } },
    claimHost() { if (joined && socket.connected) socket.emit('claim-host', { roomId: episodeId }, acknowledge); },
    sendControl(event, currentTime) {
      if (!joined || !host || !socket.connected || !['sync-play', 'sync-pause', 'sync-seek'].includes(event) || !Number.isFinite(currentTime) || currentTime < 0) return false;
      socket.emit(event, { roomId: episodeId, currentTime }, acknowledge);
      return true;
    },
    sendMessage(message, onAccepted = () => {}) {
      if (!joined || !socket.connected || typeof message !== 'string' || !message.trim() || message.length > 1000) return false;
      const currentGeneration = generation;
      socket.emit('send-message', { roomId: episodeId, message: message.trim() }, result => {
        if (closed || currentGeneration !== generation) return;
        if (result?.success && result.message) { onMessage({ ...result.message, self: true }); onAccepted(); }
        else acknowledge(result);
      });
      return true;
    },
    close() { closed = true; joined = false; host = false; socket.removeAllListeners(); socket.disconnect(); },
  };
}

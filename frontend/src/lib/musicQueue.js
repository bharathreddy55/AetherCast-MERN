export const MAX_QUEUE_SIZE = 2000;
export function selectMusicOccurrence(entries, track, index) {
  if (index === undefined) return entries.find(entry => entry.track._id === track._id);
  return Number.isSafeInteger(index) && index >= 0 && entries[index]?.track._id === track._id ? entries[index] : null;
}
export const emptyMusicQueue = () => ({ items: [], order: [], currentId: null, history: [], future: [], shuffle: false, repeat: 'off' });
export const queueEntry = (state, id = state.currentId) => state.items.find(item => item.queueItemId === id) || null;
export const orderedQueue = state => {
  const entries = new Map(state.items.map(item => [item.queueItemId, item]));
  return state.order.map(id => entries.get(id)).filter(Boolean);
};
export function musicEntries(tracks, source = 'context', makeId = () => crypto.randomUUID()) {
  if (tracks.length > MAX_QUEUE_SIZE) throw new Error(`Choose a collection of up to ${MAX_QUEUE_SIZE} songs.`);
  return tracks.map(track => ({ queueItemId: makeId(), track: { ...track, kind: 'track' }, source }));
}
function shuffled(items, random) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const next = Math.floor(random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}
export function nextQueueId(state, natural = false) {
  if (!state.currentId) return state.order[0] || null;
  if (natural && state.repeat === 'one') return state.currentId;
  return state.future[0] || state.order[state.order.indexOf(state.currentId) + 1]
    || (state.repeat === 'all' ? state.order[0] : null) || null;
}
export function previousQueueId(state) {
  return state.history.at(-1) || state.order[state.order.indexOf(state.currentId) - 1]
    || (state.repeat === 'all' ? state.order.at(-1) : null) || null;
}
export function musicQueueReducer(state, action, random = Math.random) {
  switch (action.type) {
    case 'reset': return emptyMusicQueue();
    case 'replace': {
      if (!action.items.length || action.items.length > MAX_QUEUE_SIZE || new Set(action.items.map(item => item.queueItemId)).size !== action.items.length) throw new Error('Invalid listening queue.');
      const currentId = action.currentId || action.items[0].queueItemId;
      if (!action.items.some(item => item.queueItemId === currentId)) throw new Error('Song is not in this queue.');
      const ids = action.items.map(item => item.queueItemId);
      return { ...emptyMusicQueue(), items: action.items, currentId, shuffle: state.shuffle, repeat: state.repeat,
        order: state.shuffle ? [currentId, ...shuffled(ids.filter(id => id !== currentId), random)] : ids };
    }
    case 'select': {
      if (!queueEntry(state, action.id) || state.currentId === action.id) return state;
      return { ...state, currentId: action.id, history: [...state.history, state.currentId].filter(Boolean).slice(-1000), future: [] };
    }
    case 'next': {
      const id = nextQueueId(state, action.natural);
      if (!id || id === state.currentId) return state;
      return { ...state, currentId: id, history: [...state.history, state.currentId].filter(Boolean).slice(-1000), future: state.future[0] === id ? state.future.slice(1) : [] };
    }
    case 'previous': {
      const id = previousQueueId(state);
      if (!id || id === state.currentId) return state;
      return { ...state, currentId: id, history: state.history.length ? state.history.slice(0, -1) : [], future: [state.currentId, ...state.future].filter(Boolean).slice(0, 1000) };
    }
    case 'add': {
      if (state.items.length >= MAX_QUEUE_SIZE) throw new Error(`The queue is limited to ${MAX_QUEUE_SIZE} songs.`);
      const entry = { ...action.entry, source: 'manual' };
      if (queueEntry(state, entry.queueItemId)) throw new Error('This queue entry already exists.');
      const current = state.order.indexOf(state.currentId);
      const insertInto = ids => {
        const start = ids.indexOf(state.currentId) + 1;
        let position = start;
        if (!action.next) {
          while (position < ids.length && queueEntry(state, ids[position])?.source === 'manual') position++;
        }
        return [...ids.slice(0, position), entry.queueItemId, ...ids.slice(position)];
      };
      const canonical = insertInto(state.items.map(item => item.queueItemId));
      const items = canonical.map(id => id === entry.queueItemId ? entry : queueEntry(state, id));
      return { ...state, items, order: insertInto(state.order), currentId: current < 0 ? entry.queueItemId : state.currentId, future: [] };
    }
    case 'remove': {
      const index = state.order.indexOf(action.id);
      if (index < 0) return state;
      const order = state.order.filter(id => id !== action.id);
      const currentId = state.currentId === action.id ? order[index] || order[index - 1] || null : state.currentId;
      const history = state.history.filter(id => id !== action.id), future = state.future.filter(id => id !== action.id);
      while (history.at(-1) && history.at(-1) === currentId) history.pop();
      while (future[0] && future[0] === currentId) future.shift();
      return { ...state, items: state.items.filter(item => item.queueItemId !== action.id), order,
        currentId, history, future };
    }
    case 'clearUpcoming': {
      const current = queueEntry(state);
      return { ...state, items: current ? [current] : [], order: current ? [current.queueItemId] : [], history: [], future: [] };
    }
    case 'move': {
      const index = state.order.indexOf(action.id), current = state.order.indexOf(state.currentId);
      const target = index + action.offset;
      if (![1, -1].includes(action.offset) || index <= current || target <= current || target >= state.order.length) return state;
      const order = state.order.slice();
      [order[index], order[target]] = [order[target], order[index]];
      return { ...state, order, items: order.map(id => queueEntry(state, id)), future: [] };
    }
    case 'shuffle': {
      const shuffle = !state.shuffle;
      const prefix = state.order.slice(0, state.order.indexOf(state.currentId) + 1);
      const remaining = (shuffle ? state.order : state.items.map(item => item.queueItemId)).filter(id => !prefix.includes(id));
      const manual = remaining.filter(id => queueEntry(state, id).source === 'manual');
      const context = remaining.filter(id => queueEntry(state, id).source !== 'manual');
      return { ...state, shuffle, order: [...prefix, ...manual, ...(shuffle ? shuffled(context, random) : context)], future: [] };
    }
    case 'repeat': return { ...state, repeat: ['off', 'all', 'one'].includes(action.value) ? action.value : state.repeat };
    default: return state;
  }
}

// Load complete filtered context, rather than using just a visible library page.
// Fail visibly if pages change or exceed the bound; never silently truncate.
export async function loadMusicContext({ fetchPage, signal, maxTracks = MAX_QUEUE_SIZE }) {
  const tracks = [], seen = new Set();
  let expectedTotal, pages;
  for (let page = 1; page === 1 || page <= pages; page++) {
    signal?.throwIfAborted();
    const response = await fetchPage(page, signal);
    const data = await response.json();
    signal?.throwIfAborted();
    if (!response.ok || !data.success || !Array.isArray(data.tracks)) throw new Error(data.message || 'Unable to load the listening queue.');
    if (page === 1) {
      expectedTotal = data.total; pages = data.totalPages;
      if (!Number.isInteger(expectedTotal) || expectedTotal < 0 || expectedTotal > maxTracks || !Number.isInteger(pages) || pages < 0 || pages > Math.ceil(maxTracks / 100) || pages !== Math.ceil(expectedTotal / 100)) {
        throw new Error(`Choose an album or filtered collection of up to ${maxTracks} songs.`);
      }
    }
    if (data.total !== expectedTotal || data.totalPages !== pages || data.tracks.length > 100) throw new Error('Your collection changed. Refresh and try again.');
    for (const track of data.tracks) {
      if (!track?._id || seen.has(track._id)) throw new Error('Your collection changed. Refresh and try again.');
      seen.add(track._id); tracks.push(track);
    }
  }
  if (tracks.length !== expectedTotal) throw new Error('Your collection changed. Refresh and try again.');
  return tracks;
}

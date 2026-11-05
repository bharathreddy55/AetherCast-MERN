export const musicSearchGroups = { tracks: 'Songs', artists: 'Artists', albums: 'Albums', playlists: 'Playlists' };
export function musicSearchState(params) {
  const group = Object.hasOwn(musicSearchGroups, params.get('group')) ? params.get('group') : 'all';
  const rawPage = params.get('page') || '1';
  return { q: params.get('q') || '', group, sort: params.get('sort') === 'recent' ? 'recent' : 'title',
    page: group === 'all' ? 1 : /^\d+$/.test(rawPage) ? Math.max(1, Math.min(1000, Number(rawPage))) : 1 };
}
export function musicSearchParams(state) {
  return new URLSearchParams({ q: state.q.trim(), group: state.group, sort: state.sort, page: String(state.page), limit: state.group === 'all' ? '6' : '25' }).toString();
}
export function musicSearchHref(state, changes = {}) {
  return `/music/search?${musicSearchParams({ ...state, page: 1, ...changes })}`;
}
// Abort plus a generation check: an old response cannot publish even if its transport ignores cancellation.
export function createMusicSearchLoader({ request, onResult, onError }) {
  let generation = 0, controller;
  return {
    async load(query) {
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal, current = ++generation;
      try {
        const response = await request(query, { signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to search your music.');
        if (!signal.aborted && current === generation) onResult(data, query);
      } catch (error) { if (!signal.aborted && current === generation) onError(error.message); }
    },
    cancel() { ++generation; controller?.abort(); },
  };
}

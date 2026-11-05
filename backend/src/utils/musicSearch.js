const { failure } = require('./musicLibrary');
const resources = ['tracks', 'artists', 'albums', 'playlists'];
function searchQuery(query, ownerId) {
  if (Object.keys(query).some(key => !['q', 'group', 'page', 'limit', 'sort'].includes(key))) throw failure(400, 'Unsupported music search filter');
  if (typeof query.q !== 'string' || !query.q.trim() || query.q.length > 200) throw failure(400, 'Enter a search of 1–200 characters');
  const group = query.group === undefined ? 'all' : query.group;
  if (!['all', ...resources].includes(group)) throw failure(400, 'Invalid search group');
  const sort = query.sort === undefined ? 'title' : query.sort;
  if (!['title', 'recent'].includes(sort)) throw failure(400, 'Invalid search sort');
  const integer = (value, fallback, maximum) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) throw failure(400, 'Invalid search pagination');
    return Number(value);
  };
  const page = integer(query.page, 1, 1000), limit = integer(query.limit, 12, 50);
  if (group === 'all' && page !== 1) throw failure(400, 'Select a group to page through results');
  const q = query.q.trim(), escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { q, group, page, limit, groups: group === 'all' ? resources : [group],
    forResource(resource) {
      const field = ['artists', 'playlists'].includes(resource) ? 'name' : 'title';
      return { filter: { ownerId, deletedAt: null, [field]: { $regex: escaped, $options: 'i' } },
        sort: sort === 'recent' ? { createdAt: -1, _id: -1 } : { [field]: 1, _id: 1 }, skip: (page - 1) * limit };
    } };
}
module.exports = { searchQuery };

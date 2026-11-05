const mongoose = require('mongoose');
const { id, musicDto } = require('./musicCatalog');
const failure = (status, message) => Object.assign(new Error(message), { status });
const active = ownerId => ({ ownerId, deletedAt: null });
function exactBody(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) throw failure(400, 'Unsupported library fields');
  return body;
}
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw failure(400, 'Invalid library text');
  return value.trim();
}
function version(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw failure(400, 'A valid playlist version is required');
  return value;
}
function ids(values, maximum = 2000) {
  if (!Array.isArray(values) || !values.length || values.length > maximum) throw failure(400, 'Invalid library item list');
  return values.map(id);
}
function pagination(query = {}) {
  if (Object.keys(query).some(key => !['page', 'limit'].includes(key))) throw failure(400, 'Unsupported library filter');
  const number = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw failure(400, 'Invalid library pagination');
    return Number(value);
  };
  const page = number(query.page, 1, 10000), limit = number(query.limit, 25, 100);
  return { page, limit, skip: (page - 1) * limit };
}
function population(resource, ownerId) {
  const art = path => ({ path, match: { ownerId, kind: 'image', status: 'ready' }, select: '+objectKey' });
  const artists = path => ({ path, match: active(ownerId), select: 'name' });
  if (resource === 'artists') return [art('imageAssetId')];
  if (resource === 'albums') return [artists('artistIds'), art('coverAssetId')];
  return [artists('artistCredits.artistId'), art('coverAssetId'),
    { path: 'albumId', match: active(ownerId), select: 'title coverAssetId', populate: art('coverAssetId') }];
}
function playlistDto(value) { return { _id: value._id, name: value.name, description: value.description || '', version: value.version, itemCount: value.items.length, updatedAt: value.updatedAt }; }
function playlistItems(value) {
  return value.items.map((item, position) => ({ _id: item._id, position, unavailable: !item.trackId,
    track: item.trackId ? musicDto('tracks', item.trackId) : null }));
}
function playlistEdit(document, body) {
  exactBody(body, ['version', 'operation', 'name', 'description', 'trackIds', 'itemIds']); version(body.version);
  const allowed = { rename: ['name', 'description'], add: ['trackIds'], remove: ['itemIds'], reorder: ['itemIds'] }[body.operation];
  if (!allowed || Object.keys(body).some(key => !['version', 'operation', ...allowed].includes(key))) throw failure(400, 'Invalid playlist operation');
  if (body.operation === 'rename') return { name: text(body.name, 200, true), description: body.description === undefined ? document.description : text(body.description, 2000) };
  if (body.operation === 'add') {
    const trackIds = ids(body.trackIds, 100);
    if (document.items.length + trackIds.length > 2000) throw failure(400, 'A playlist can contain up to 2000 songs');
    return { items: [...document.items, ...trackIds.map(trackId => ({ _id: new mongoose.Types.ObjectId(), trackId, addedAt: new Date() }))] };
  }
  const itemIds = ids(body.itemIds);
  const existing = new Map(document.items.map(item => [String(item._id), item]));
  if (new Set(itemIds).size !== itemIds.length || itemIds.some(itemId => !existing.has(itemId))) throw failure(400, 'Invalid playlist item selection');
  if (body.operation === 'reorder') {
    if (itemIds.length !== document.items.length) throw failure(400, 'Provide the complete playlist item order');
    return { items: itemIds.map(itemId => existing.get(itemId)) };
  }
  return { items: document.items.filter(item => !itemIds.includes(String(item._id))) };
}
module.exports = { failure, active, exactBody, text, version, ids, pagination, population, playlistDto, playlistItems, playlistEdit };

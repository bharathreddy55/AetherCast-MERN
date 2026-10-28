const mongoose = require('mongoose');
const { createMediaLink } = require('./mediaLinks');
const { parseMediaReference } = require('./mediaReferences');
const badRequest = message => Object.assign(new Error(message), { status: 400 });
const id = value => {
  if (typeof value !== 'string' || !mongoose.isObjectIdOrHexString(value)) throw badRequest('A valid music record ID is required');
  return value;
};
const fields = {
  artists: ['name', 'biography', 'imageAssetId'],
  albums: ['title', 'artistIds', 'isCompilation', 'coverAssetId', 'releaseDate', 'genres', 'language', 'description'],
  tracks: ['title', 'artistCredits', 'albumId', 'audioAssetId', 'coverAssetId', 'discNumber', 'trackNumber', 'releaseDate', 'genres', 'language', 'explicit'],
};

function musicInput(resource, body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) throw badRequest('Provide music metadata');
  const result = {};
  for (const [key, value] of Object.entries(body)) {
    if (!fields[resource].includes(key) || (!creating && key === 'audioAssetId')) throw badRequest(`Unsupported metadata field: ${key}`);
    if (['name', 'title', 'biography', 'description', 'language'].includes(key)) {
      const max = { name: 200, title: 300, biography: 5000, description: 5000, language: 64 }[key];
      if (typeof value !== 'string' || value.trim().length > max || (['name', 'title'].includes(key) && !value.trim())) throw badRequest(`Invalid ${key}`);
      result[key] = value.trim();
    } else if (['imageAssetId', 'coverAssetId', 'albumId'].includes(key)) result[key] = value === null ? null : id(value);
    else if (key === 'audioAssetId') result[key] = id(value);
    else if (['isCompilation', 'explicit'].includes(key)) {
      if (typeof value !== 'boolean') throw badRequest(`Invalid ${key}`);
      result[key] = value;
    } else if (['trackNumber', 'discNumber'].includes(key)) {
      if (!Number.isSafeInteger(value) || value < 1) throw badRequest(`Invalid ${key}`);
      result[key] = value;
    } else if (key === 'releaseDate') {
      if (value === null) result[key] = null;
      else {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw badRequest('Release date must be a valid YYYY-MM-DD date');
        result[key] = value;
      }
    } else if (key === 'genres') {
      if (!Array.isArray(value) || value.length > 20 || value.some(item => typeof item !== 'string' || !item.trim() || item.trim().length > 64)) throw badRequest('Provide at most 20 valid genres');
      result[key] = [...new Set(value.map(item => item.trim()))];
    } else if (key === 'artistIds') {
      if (!Array.isArray(value) || value.length > 20) throw badRequest('Provide at most 20 album artists');
      result[key] = [...new Set(value.map(id))];
    } else if (key === 'artistCredits') {
      if (!Array.isArray(value) || !value.length || value.length > 20) throw badRequest('Provide between 1 and 20 artist credits');
      result[key] = value.map(credit => {
        if (!credit || typeof credit !== 'object' || Array.isArray(credit) || Object.keys(credit).some(field => !['artistId', 'role'].includes(field))) throw badRequest('Invalid artist credit');
        const role = credit.role || 'primary';
        if (!['primary', 'featured'].includes(role)) throw badRequest('Invalid artist role');
        return { artistId: id(credit.artistId), role };
      });
      if (!result[key].some(credit => credit.role === 'primary') || new Set(result[key].map(credit => credit.artistId)).size !== result[key].length) throw badRequest('Use unique artist credits with at least one primary artist');
    }
  }
  if (creating) {
    const required = resource === 'artists' ? ['name'] : resource === 'albums' ? ['title'] : ['title', 'artistCredits', 'audioAssetId'];
    if (required.some(key => result[key] === undefined)) throw badRequest(`Required metadata: ${required.join(', ')}`);
    if (resource === 'albums' && !result.isCompilation && !result.artistIds?.length) throw badRequest('Albums need artists or must be marked as compilations');
  }
  return result;
}

function catalogQuery(resource, query, ownerId) {
  const allowed = ['search', 'page', 'limit', 'sort', ...(resource === 'tracks' ? ['artistId', 'albumId'] : [])];
  if (Object.keys(query).some(key => !allowed.includes(key))) throw badRequest('Unsupported catalog filter');
  const integer = (value, fallback, maximum) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) throw badRequest('Invalid catalog pagination');
    return Number(value);
  };
  const page = integer(query.page, 1, 10000);
  const limit = integer(query.limit, 25, 100);
  const filter = { ownerId, deletedAt: null };
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 200) throw badRequest('Invalid catalog search');
    filter[resource === 'artists' ? 'name' : 'title'] = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (query.artistId !== undefined) filter['artistCredits.artistId'] = id(query.artistId);
  if (query.albumId !== undefined) filter.albumId = id(query.albumId);
  const sortName = query.sort || 'title';
  if (typeof sortName !== 'string') throw badRequest('Invalid catalog sort');
  const sorts = { title: { [resource === 'artists' ? 'name' : 'title']: 1, _id: 1 }, recent: { createdAt: -1, _id: -1 } };
  if (resource === 'tracks') sorts.album = { discNumber: 1, trackNumber: 1, _id: 1 };
  if (!Object.hasOwn(sorts, sortName)) throw badRequest('Invalid catalog sort');
  return { filter, sort: sorts[sortName], page, limit, skip: (page - 1) * limit };
}

function assetReference(asset) {
  const reference = asset.storageProvider === 'supabase' ? `supabase://${asset.bucket}/${asset.objectKey}` : `/uploads/${asset.objectKey}`;
  if (!parseMediaReference(reference)) throw Object.assign(new Error('Media storage configuration does not match this asset'), { status: 503 });
  return reference;
}
const cover = asset => {
  if (!asset || asset.status !== 'ready' || asset.kind !== 'image') return '';
  try { return createMediaLink(assetReference(asset)); } catch { return ''; }
};
const artistLabel = value => ({ _id: value?._id || value, name: value?.name || '' });
function musicDto(resource, document) {
  const value = typeof document.toObject === 'function' ? document.toObject() : document;
  if (resource === 'artists') return { _id: value._id, name: value.name, biography: value.biography || '', imageAssetId: value.imageAssetId?._id || value.imageAssetId, coverImage: cover(value.imageAssetId) };
  if (resource === 'albums') return { _id: value._id, title: value.title, artists: (value.artistIds || []).filter(Boolean).map(artistLabel),
    isCompilation: value.isCompilation, coverAssetId: value.coverAssetId?._id || value.coverAssetId, coverImage: cover(value.coverAssetId),
    releaseDate: value.releaseDate, genres: value.genres || [], language: value.language || '', description: value.description || '' };
  return { _id: value._id, kind: 'track', title: value.title,
    artistCredits: (value.artistCredits || []).filter(credit => credit.artistId).map(credit => ({ artist: artistLabel(credit.artistId), role: credit.role })),
    album: value.albumId ? { _id: value.albumId._id || value.albumId, title: value.albumId.title || '' } : null,
    audioAssetId: value.audioAssetId?._id || value.audioAssetId, coverAssetId: value.coverAssetId?._id || value.coverAssetId,
    coverImage: cover(value.coverAssetId) || cover(value.albumId?.coverAssetId), duration: value.duration,
    discNumber: value.discNumber, trackNumber: value.trackNumber, genres: value.genres || [], language: value.language || '',
    releaseDate: value.releaseDate, explicit: value.explicit || false };
}
module.exports = { id, musicInput, catalogQuery, musicDto, assetReference };

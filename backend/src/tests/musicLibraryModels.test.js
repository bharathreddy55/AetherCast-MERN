const MusicPlaylist = require('../models/MusicPlaylist');
const TrackLike = require('../models/TrackLike');
const SavedAlbum = require('../models/SavedAlbum');
const FollowedArtist = require('../models/FollowedArtist');
const ListeningEvent = require('../models/ListeningEvent');
const { playlistEdit, pagination } = require('../utils/musicLibrary');
const owner = '507f1f77bcf86cd799439011', trackId = '507f191e810c19729de860ea';
const first = '507f191e810c19729de860eb', second = '507f191e810c19729de860ec';
const playlist = () => ({ name: 'Mix', description: '', items: [{ _id: first, trackId }, { _id: second, trackId }] });

test('playlist occurrences have distinct IDs even for repeated tracks and bounded storage', () => {
  const value = new MusicPlaylist({ ownerId: owner, name: 'Mix', items: [{ trackId }, { trackId }] });
  expect(value.validateSync()).toBeUndefined();
  expect(String(value.items[0]._id)).not.toBe(String(value.items[1]._id));
  value.items = Array.from({ length: 2001 }, () => ({ trackId }));
  expect(value.validateSync()).toBeDefined();
});
test('personal-reference indexes include the owner and are unique', () => {
  for (const [Model, field] of [[TrackLike, 'trackId'], [SavedAlbum, 'albumId'], [FollowedArtist, 'artistId']]) {
    expect(Model.schema.indexes()).toContainEqual([{ ownerId: 1, [field]: 1 }, expect.objectContaining({ unique: true })]);
    expect(Model.schema.path('ownerId').options.immutable).toBe(true);
  }
});
test('listening sessions have owner-scoped idempotency and expiring history', () => {
  expect(ListeningEvent.schema.indexes()).toContainEqual([{ ownerId: 1, playbackId: 1 }, expect.objectContaining({ unique: true })]);
  expect(ListeningEvent.schema.indexes()).toContainEqual([{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })]);
});
test('playlist reordering uses complete item IDs and preserves repeated track occurrences', () => {
  const changed = playlistEdit(playlist(), { version: 0, operation: 'reorder', itemIds: [second, first] });
  expect(changed.items.map(item => item._id)).toEqual([second, first]);
  expect(changed.items.every(item => item.trackId === trackId)).toBe(true);
});
test.each([[first], [first, first], [first, trackId]])('partial/duplicate/foreign reorder item selections fail: %j', (...items) => {
  expect(() => playlistEdit(playlist(), { version: 0, operation: 'reorder', itemIds: items })).toThrow();
});
test('removal targets an occurrence, not every copy of a song', () => {
  expect(playlistEdit(playlist(), { version: 0, operation: 'remove', itemIds: [first] }).items).toEqual([{ _id: second, trackId }]);
});
test.each([
  { operation: 'add', version: 0, trackIds: [trackId], ownerId: owner },
  { operation: 'rename', version: -1, name: 'x' }, { operation: 'rename', version: 0, name: ' ' },
  { operation: 'add', version: 0, trackIds: [] }, { operation: 'add', version: 0, itemIds: [first] },
])('invalid playlist edit fields and versions fail: %j', body => {
  expect(() => playlistEdit(playlist(), body)).toThrow();
});
test('library pagination rejects unbounded and unsupported values', () => {
  expect(pagination({ page: '2', limit: '25' })).toEqual({ page: 2, limit: 25, skip: 25 });
  for (const query of [{ limit: '101' }, { page: '-1' }, { limit: 'Infinity' }, { ownerId: owner }]) expect(() => pagination(query)).toThrow();
});

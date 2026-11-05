for (const name of ['Track', 'Artist', 'Album', 'MusicPlaylist']) {
  jest.mock(`../models/${name}`, () => ({ find: jest.fn(), countDocuments: jest.fn() }));
}
const Track = require('../models/Track');
const Artist = require('../models/Artist');
const Album = require('../models/Album');
const MusicPlaylist = require('../models/MusicPlaylist');
const { search } = require('../controllers/musicSearchController');
const { searchQuery } = require('../utils/musicSearch');
const { catalogQuery } = require('../utils/musicCatalog');
const ownerId = '507f1f77bcf86cd799439011';
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const chain = rows => {
  const value = { lean: jest.fn().mockResolvedValue(rows) };
  for (const name of ['sort', 'skip', 'limit', 'maxTimeMS', 'populate', 'select']) value[name] = jest.fn().mockReturnValue(value);
  return value;
};
beforeEach(() => {
  jest.resetAllMocks();
  for (const Model of [Track, Artist, Album, MusicPlaylist]) {
    Model.find.mockReturnValue(chain([]));
    Model.countDocuments.mockReturnValue({ maxTimeMS: jest.fn().mockResolvedValue(0) });
  }
});
test('literal Unicode/name matching is owner-scoped and does not interpret regex syntax', () => {
  const query = searchQuery({ q: '  గీతం.*[a]  ' }, ownerId);
  const options = query.forResource('tracks');
  expect(options.filter).toEqual({ ownerId, deletedAt: null, title: { $regex: 'గీతం\\.\\*\\[a\\]', $options: 'i' } });
  const expression = new RegExp(options.filter.title.$regex, 'i');
  expect(expression.test('గీతం.*[a]')).toBe(true);
  expect(expression.test('గీతం something a')).toBe(false);
  expect(query.forResource('artists').filter.name).toEqual(options.filter.title);
  expect(query.forResource('playlists').filter.name).toEqual(options.filter.title);
});
test.each([{ q: '' }, { q: '   ' }, { q: ['song'] }, { q: { $ne: '' } }, { q: 'a'.repeat(201) },
  { q: 'song', ownerId: 'attacker' }, { q: 'song', group: 'podcasts' }, { q: 'song', group: ['tracks'] },
  { q: 'song', sort: 'random' }, { q: 'song', limit: '51' }, { q: 'song', page: '0' },
  { q: 'song', page: '2' }, { q: 'song', group: 'tracks', page: '1001' }, { q: 'song', limit: {} }])('rejects unsafe/unbounded query %j without database work', async query => {
  const res = response(); await search({ query, user: { _id: ownerId } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(Track.find).not.toHaveBeenCalled(); expect(MusicPlaylist.find).not.toHaveBeenCalled();
});
test('group pagination and sorts use deterministic tie breakers', () => {
  const options = searchQuery({ q: 'Song', group: 'tracks', page: '3', limit: '25', sort: 'recent' }, ownerId);
  expect(options.groups).toEqual(['tracks']);
  expect(options.forResource('tracks')).toMatchObject({ skip: 50, sort: { createdAt: -1, _id: -1 } });
  expect(searchQuery({ q: 'a' }, ownerId).forResource('albums').sort).toEqual({ title: 1, _id: 1 });
});
test('grouped results have bounded owner-only queries/population and explicit safe DTOs', async () => {
  const track = chain([{ _id: 'track', title: 'Song', artistCredits: [], duration: 180, ownerId, objectKey: 'secret', token: 'secret' }]);
  Track.find.mockReturnValue(track);
  MusicPlaylist.find.mockReturnValue(chain([{ _id: 'playlist', name: 'Songs', version: 2, items: [{ _id: 'entry', trackId: 'secret' }], ownerId }]));
  const res = response(); await search({ query: { q: 'song', limit: '6' }, user: { _id: ownerId } }, res);
  const body = res.json.mock.calls[0][0];
  expect(Object.keys(body.groups)).toEqual(['tracks', 'artists', 'albums', 'playlists']);
  for (const Model of [Track, Artist, Album, MusicPlaylist]) {
    expect(Model.find.mock.calls[0][0]).toMatchObject({ ownerId, deletedAt: null });
    expect(Model.countDocuments.mock.calls[0][0]).toEqual(Model.find.mock.calls[0][0]);
    const query = Model.find.mock.results[0].value;
    expect(query.limit).toHaveBeenCalledWith(6); expect(query.maxTimeMS).toHaveBeenCalledWith(2000);
  }
  expect(track.populate.mock.calls[0][0][0].match).toMatchObject({ ownerId, deletedAt: null });
  expect(body.groups.playlists.items[0]).toMatchObject({ itemCount: 1, name: 'Songs' });
  expect(JSON.stringify(body)).not.toMatch(/secret|ownerId|objectKey|trackId/);
});
test('a selected category does not query other collections and keeps requested paging', async () => {
  const res = response(); await search({ query: { q: 'Artist', group: 'artists', page: '2' }, user: { _id: ownerId } }, res);
  expect(Artist.find.mock.results[0].value.skip).toHaveBeenCalledWith(12);
  expect(Track.find).not.toHaveBeenCalled(); expect(Album.find).not.toHaveBeenCalled(); expect(MusicPlaylist.find).not.toHaveBeenCalled();
  expect(res.json.mock.calls[0][0].groups.artists).toMatchObject({ page: 2, total: 0, totalPages: 0, items: [] });
});
test('timeout/failure never leaks partial data or internal database messages', async () => {
  for (const failure of [{ code: 50, message: 'secret database details' }, new Error('secret database details')]) {
    const query = chain([]); query.lean.mockRejectedValue(failure); Track.find.mockReturnValue(query);
    const res = response(); await search({ query: { q: 'song' }, user: { _id: ownerId } }, res);
    expect(res.status).toHaveBeenCalledWith(failure.code === 50 ? 503 : 500);
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('groups');
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret');
  }
});
test('duration sort applies only to songs and retains deterministic ordering', () => {
  expect(catalogQuery('tracks', { sort: 'duration' }, ownerId).sort).toEqual({ duration: 1, _id: 1 });
  expect(() => catalogQuery('albums', { sort: 'duration' }, ownerId)).toThrow();
});

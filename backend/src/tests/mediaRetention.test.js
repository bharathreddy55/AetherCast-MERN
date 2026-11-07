for (const name of ['MediaAsset', 'Track', 'Album', 'Artist', 'MusicImport', 'MediaProcessingJob']) {
  jest.mock(`../models/${name}`, () => ({ find: jest.fn(), distinct: jest.fn(), exists: jest.fn() }));
}
const MediaAsset = require('../models/MediaAsset');
const Track = require('../models/Track');
const Album = require('../models/Album');
const Artist = require('../models/Artist');
const MusicImport = require('../models/MusicImport');
const MediaProcessingJob = require('../models/MediaProcessingJob');
const { retentionItem, retentionOptions, storageAliasFilter } = require('../utils/mediaRetention');
const { mediaRetentionReport } = require('../services/mediaRetentionReport');
const { runCli, parseArguments } = require('../scripts/mediaRetention');
const owner = '507f1f77bcf86cd799439011', assetId = '507f191e810c19729de860ea', parent = '507f191e810c19729de860eb';
const now = new Date('2026-11-06T00:00:00Z');
const old = new Date('2026-09-01T00:00:00Z');
const asset = extra => ({ _id: assetId, ownerId: owner, kind: 'audio', status: 'ready', byteSize: 100,
  originalAssetId: parent, createdAt: old, updatedAt: old, storageProvider: 'supabase', bucket: 'vox', objectKey: 'audios/example.mp3', ...extra });
const query = data => {
  const result = { lean: jest.fn(async () => data) };
  for (const name of ['select', 'sort', 'limit', 'maxTimeMS']) result[name] = jest.fn(() => result);
  return result;
};
const distinct = value => ({ maxTimeMS: jest.fn(async () => value) });
beforeEach(() => {
  jest.clearAllMocks();
  MediaAsset.find.mockReturnValue(query([asset()]));
  MediaAsset.exists.mockImplementation(() => distinct(null));
  for (const model of [MediaAsset, Track, Album, Artist, MusicImport, MediaProcessingJob]) model.distinct.mockImplementation(() => distinct([]));
});

test('originals, including checksum-reused originals, remain protected at every age', () => {
  for (const originalAssetId of [null, undefined]) {
    expect(retentionItem(asset({ originalAssetId }), [], now.getTime(), 30)).toMatchObject({ category: 'original' });
  }
});

test('an old unused derivative is review-only, not a deletion command', async () => {
  const result = await mediaRetentionReport(owner, {}, { now });
  expect(result).toMatchObject({ mode: 'review-only', deletionSupported: false, scope: 'owner-page', retentionDays: 30,
    summary: { scanned: 1, original: 0, protected: 0, retained: 0, review: 1, knownBytes: 100, reviewBytes: 100 }, nextCursor: null });
  expect(result.items[0]).toMatchObject({ assetId, category: 'review', ageDays: 66 });
});

test('retention uses the newer timestamp and protects malformed or future dates', () => {
  for (const extra of [{ updatedAt: new Date('2026-11-01') }, { createdAt: null }, { updatedAt: null }, { updatedAt: 'invalid' },
    { updatedAt: new Date('2027-01-01') }, { createdAt: now, updatedAt: old }]) {
    expect(retentionItem(asset(extra), [], now.getTime(), 30).category).toBe('retained');
  }
  const boundary = new Date(now.getTime() - 30 * 86400000);
  expect(retentionItem(asset({ createdAt: boundary, updatedAt: boundary }), [], now.getTime(), 30).category).toBe('review');
});

test('pending, failed, malformed or unknown media is retained even without references', () => {
  for (const extra of [{ status: 'pending' }, { status: 'processing' }, { status: 'failed' }, { byteSize: Infinity }, { byteSize: -1 }, { byteSize: 1.5 }, { kind: 'unknown' }, { originalAssetId: 'bad-id' }, { originalAssetId: assetId }]) {
    expect(retentionItem(asset(extra), [], now.getTime(), 30).category).toBe('retained');
  }
});

test('all catalog/import/job/thumbnail references protect assets, without excluding deleted/cancelled records', async () => {
  for (const model of [MediaAsset, Track, Album, Artist, MusicImport, MediaProcessingJob]) model.distinct.mockImplementation(() => distinct([assetId]));
  const result = await mediaRetentionReport(owner, {}, { now });
  expect(result.items[0].category).toBe('protected');
  expect(result.items[0].reasons).toEqual(expect.arrayContaining(['track-audio', 'track-cover', 'album-cover', 'artist-image', 'import-audio', 'import-cover', 'processing-source', 'processing-output', 'derivative-source', 'artwork-thumbnail']));
  for (const model of [MediaAsset, Track, Album, Artist, MusicImport]) for (const [field, filter] of model.distinct.mock.calls) {
    expect(filter).toEqual({ ownerId: owner, [field]: { $in: [assetId] } });
    expect(filter.deletedAt).toBeUndefined(); expect(filter.status).toBeUndefined();
  }
});

test('queued/processing source jobs protect old sibling derivatives while they may be reused', async () => {
  MediaProcessingJob.distinct.mockImplementation((field, filter) => distinct(filter.status ? [parent] : []));
  const result = await mediaRetentionReport(owner, {}, { now });
  expect(result.items[0]).toMatchObject({ category: 'protected', reasons: ['source-job-in-progress'] });
  expect(MediaProcessingJob.distinct).toHaveBeenCalledWith('sourceAssetId', { ownerId: owner, sourceAssetId: { $in: [parent] }, status: { $in: ['queued', 'processing'] } });
});

test('a malformed derivative source stays retained without entering an ObjectId lookup', async () => {
  MediaAsset.find.mockReturnValue(query([asset({ originalAssetId: 'bad-parent' })]));
  const result = await mediaRetentionReport(owner, {}, { now });
  expect(result.items[0].category).toBe('retained');
  expect(MediaProcessingJob.distinct.mock.calls.some(([, filter]) => filter.status)).toBe(false);
});

test('uses owner-scoped cursor pagination with bounded projections, results and queries', async () => {
  const nextId = '507f191e810c19729de860ec', chain = query([asset(), asset({ _id: nextId })]);
  MediaAsset.find.mockReturnValue(chain);
  const result = await mediaRetentionReport(owner, { limit: 1, after: parent }, { now });
  expect(MediaAsset.find).toHaveBeenCalledWith({ ownerId: owner, _id: { $gt: parent } });
  expect(chain.limit).toHaveBeenCalledWith(2); expect(chain.sort).toHaveBeenCalledWith({ _id: 1 }); expect(chain.maxTimeMS).toHaveBeenCalledWith(5000);
  expect(chain.select).toHaveBeenCalledWith('_id kind status byteSize originalAssetId createdAt updatedAt storageProvider bucket +objectKey');
  expect(result.nextCursor).toBe(assetId); expect(result.summary.scanned).toBe(1);
  expect(Track.distinct.mock.calls.every(([, filter]) => filter.audioAssetId?.$in?.length === 1 || filter.coverAssetId?.$in?.length === 1)).toBe(true);
});

test('empty pages do not launch reference scans or pretend to be full-library totals', async () => {
  MediaAsset.find.mockReturnValue(query([]));
  const result = await mediaRetentionReport(owner, {}, { now });
  expect(result.items).toEqual([]); expect(result.scope).toBe('owner-page'); expect(result.summary.knownBytes).toBe(0);
  expect(Track.distinct).not.toHaveBeenCalled();
  expect(MediaAsset.exists).not.toHaveBeenCalled();
});

test('an exact storage alias protects a derivative across every owner and status', async () => {
  MediaAsset.exists.mockReturnValue(distinct({ _id: 'private-other-asset' }));
  const report = await mediaRetentionReport(owner, {}, { now });
  expect(report).toMatchObject({ version: 2, storageChecks: 'asset-record-aliases-only', summary: { protected: 1, review: 0, reviewBytes: 0 } });
  expect(report.items[0]).toMatchObject({ category: 'protected', reasons: ['shared-storage-object'] });
  expect(MediaAsset.exists).toHaveBeenCalledWith({ _id: { $ne: assetId }, storageProvider: 'supabase', bucket: 'vox', objectKey: 'audios/example.mp3' });
  expect(JSON.stringify(report)).not.toContain('private-other-asset');
  expect(MediaAsset.exists.mock.results[0].value.maxTimeMS).toHaveBeenCalledWith(5000);
});

test('storage identity uses exact provider/bucket/key and local keys ignore unused bucket fields', () => {
  expect(storageAliasFilter(asset({ storageProvider: 'local', bucket: 'legacy-unused' }))).toEqual({ _id: { $ne: assetId }, storageProvider: 'local', objectKey: 'audios/example.mp3' });
  expect(storageAliasFilter(asset({ bucket: 'other', objectKey: 'Audio/é song.mp3' }))).toMatchObject({ bucket: 'other', objectKey: 'Audio/é song.mp3' });
});

test('missing or malformed storage identity is protected without an unsafe lookup', async () => {
  for (const extra of [{ objectKey: undefined }, { objectKey: '' }, { objectKey: { $ne: '' } }, { objectKey: '../secret' },
    { objectKey: 'a//b' }, { objectKey: 'a\\b' }, { objectKey: 'a%20b' }, { objectKey: 'a?b' }, { objectKey: 'a#b' }, { objectKey: 'a\0b' },
    { objectKey: 'a'.repeat(1025) }, { bucket: '' }, { bucket: '$bad' }, { bucket: {} }, { bucket: 'a'.repeat(101) }, { storageProvider: 'unknown' }]) {
    MediaAsset.find.mockReturnValue(query([asset(extra)])); MediaAsset.exists.mockClear();
    const result = await mediaRetentionReport(owner, {}, { now });
    expect(result.items[0]).toMatchObject({ category: 'protected', reasons: ['storage-identity-unverified'] });
    expect(MediaAsset.exists).not.toHaveBeenCalled();
  }
});

test('an alias lookup failure aborts the entire report', async () => {
  MediaAsset.exists.mockReturnValue({ maxTimeMS: async () => { throw new Error('alias check timed out'); } });
  await expect(mediaRetentionReport(owner, {}, { now })).rejects.toThrow('alias check timed out');
});

test('alias queries cover only returned page records with at most four active checks', async () => {
  const records = Array.from({ length: 10 }, (_, i) => asset({ _id: (BigInt('0x' + assetId) + BigInt(i)).toString(16) }));
  MediaAsset.find.mockReturnValue(query(records));
  let active = 0, peak = 0;
  MediaAsset.exists.mockImplementation(() => ({ maxTimeMS: async () => {
    active++; peak = Math.max(peak, active); await new Promise(setImmediate); active--; return null;
  } }));
  const report = await mediaRetentionReport(owner, { limit: 9 }, { now });
  expect(report.items).toHaveLength(9); expect(MediaAsset.exists).toHaveBeenCalledTimes(9); expect(peak).toBe(4);
});

test('originals stay original when an alias exists or their storage identity is incomplete', async () => {
  MediaAsset.find.mockReturnValue(query([asset({ originalAssetId: null, objectKey: undefined })]));
  expect((await mediaRetentionReport(owner, {}, { now })).items[0]).toMatchObject({ category: 'original', reasons: expect.arrayContaining(['storage-identity-unverified']) });
});

test('query failures abort the report instead of treating unknown references as absent', async () => {
  Track.distinct.mockReturnValue({ maxTimeMS: async () => { throw new Error('DB unavailable'); } });
  await expect(mediaRetentionReport(owner, {}, { now })).rejects.toThrow('DB unavailable');
});

test('invalid sizes are counted explicitly and unsafe totals cannot be reported as accurate', async () => {
  MediaAsset.find.mockReturnValueOnce(query([asset({ byteSize: NaN })]));
  expect((await mediaRetentionReport(owner, {}, { now })).summary).toMatchObject({ unknownSize: 1, knownBytes: 0, retained: 1 });
  MediaAsset.find.mockReturnValueOnce(query([asset({ byteSize: Number.MAX_SAFE_INTEGER }), asset({ _id: parent })]));
  await expect(mediaRetentionReport(owner, {}, { now })).rejects.toThrow('totals');
});

test('report omits names, ownership, checksums, paths, signed links and credentials', async () => {
  MediaAsset.find.mockReturnValue(query([asset({ originalName: 'secret-name', objectKey: 'private/path', checksum: 'secret-checksum', bucket: 'secret-bucket', audioUrl: 'secret-url', leaseToken: 'secret-token' })]));
  const json = JSON.stringify(await mediaRetentionReport(owner, {}, { now }));
  for (const secret of ['secret-name', 'private/path', 'secret-checksum', 'secret-bucket', 'secret-url', 'secret-token', owner]) expect(json).not.toContain(secret);
});

test('rejects unsupported limits, short retention periods, malformed IDs, identities and delete flags', async () => {
  for (const options of [{ limit: 0 }, { limit: 101 }, { limit: '50' }, { after: { $gt: '' } }, { after: 'invalid' }, { retentionDays: 29 }, { retentionDays: 3651 }, { apply: true }]) expect(() => retentionOptions(options)).toThrow();
  await expect(mediaRetentionReport('not-owner', {}, { now })).rejects.toThrow();
  await expect(mediaRetentionReport(owner, {}, { now: 'invalid' })).rejects.toThrow();
  for (const args of [['--apply'], ['--limit=1', '--limit=2'], ['--limit=1e2'], ['--retention-days=0'], ['--owner=other'], ['--output=secret']]) expect(() => parseArguments(args)).toThrow();
  expect(parseArguments(['--limit=100', `--after=${assetId}`, '--retention-days=90'])).toEqual({ limit: 100, after: assetId, retentionDays: 90 });
});

function cliDependencies(extra = {}) {
  return { env: { MONGO_URI: 'mongodb://private-uri', OWNER_SUPABASE_USER_ID: '11111111-1111-4111-8111-111111111111' },
    db: { connect: jest.fn(async () => {}), disconnect: jest.fn(async () => {}) }, ownerLookup: jest.fn(async () => ({ _id: owner })),
    report: jest.fn(async () => ({ mode: 'review-only', deletionSupported: false })), output: jest.fn(), error: jest.fn(), ...extra };
}

test('CLI connects without index/collection creation, resolves configured owner and disconnects before output', async () => {
  const deps = cliDependencies();
  expect(await runCli(['--limit=10'], deps)).toBe(0);
  expect(deps.db.connect).toHaveBeenCalledWith('mongodb://private-uri', expect.objectContaining({ autoIndex: false, autoCreate: false, bufferCommands: false, maxPoolSize: 2 }));
  expect(deps.ownerLookup).toHaveBeenCalledWith(deps.env.OWNER_SUPABASE_USER_ID);
  expect(deps.report).toHaveBeenCalledWith(owner, { limit: 10, after: '', retentionDays: 30 });
  expect(deps.db.disconnect).toHaveBeenCalledTimes(1);
  expect(deps.db.disconnect.mock.invocationCallOrder[0]).toBeLessThan(deps.output.mock.invocationCallOrder[0]);
  expect(JSON.parse(deps.output.mock.calls[0][0]).deletionSupported).toBe(false);
});

test('CLI help and invalid/configuration inputs never connect to a database', async () => {
  for (const args of [['--help'], ['--apply']]) {
    const deps = cliDependencies();
    expect(await runCli(args, deps)).toBe(args[0] === '--help' ? 0 : 1);
    expect(deps.db.connect).not.toHaveBeenCalled();
  }
  const deps = cliDependencies({ env: {} });
  expect(await runCli([], deps)).toBe(1); expect(deps.db.connect).not.toHaveBeenCalled();
});

test('CLI failures close connections, omit sensitive errors and do not emit partial reports', async () => {
  for (const stage of ['connect', 'owner', 'report', 'disconnect']) {
    const deps = cliDependencies();
    const fail = async () => { throw new Error('secret-uri-password'); };
    if (stage === 'connect' || stage === 'disconnect') deps.db[stage].mockImplementation(fail);
    else if (stage === 'owner') deps.ownerLookup.mockResolvedValue(null);
    else deps.report.mockImplementation(fail);
    expect(await runCli([], deps)).toBe(1);
    expect(deps.output).not.toHaveBeenCalled(); expect(deps.db.disconnect).toHaveBeenCalled();
    expect(JSON.stringify(deps.error.mock.calls)).not.toContain('secret-uri-password');
  }
});

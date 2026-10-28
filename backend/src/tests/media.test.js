const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const { createMediaLink, privateMediaResponses } = require('../utils/mediaLinks');
const { parseMediaReference, uploadsRoot } = require('../utils/mediaReferences');
const { uploadToSupabase, saveFileLocally } = require('../utils/supabaseStorage');

const originalEnv = { ...process.env };
const ownerId = '11111111-1111-4111-8111-111111111111';
const secret = 'test-only-media-signing-secret-123456789';
const filename = `media-test-${crypto.randomUUID()}.mp3`;
const fixture = path.join(uploadsRoot, filename);
const localRef = `/uploads/${filename}`;

beforeAll(() => { fs.mkdirSync(uploadsRoot, { recursive: true }); fs.writeFileSync(fixture, Buffer.from('0123456789')); });
beforeEach(() => {
  process.env.OWNER_SUPABASE_USER_ID = ownerId;
  process.env.MEDIA_SIGNING_SECRET = secret;
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_STORAGE_BUCKET = 'vox';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-server-key';
});
afterEach(() => { jest.restoreAllMocks(); process.env = { ...originalEnv }; });
afterAll(() => { fs.unlinkSync(fixture); });

test('direct uploads are inaccessible even if the filename is known', async () => {
  expect((await request(app).get(localRef)).status).toBe(404);
});

test('a valid temporary media link returns the file without an account token in its URL', async () => {
  const link = createMediaLink(localRef);
  const response = await request(app).get(link);
  expect(response.status).toBe(200);
  expect(response.headers['content-length']).toBe('10');
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.headers['referrer-policy']).toBe('no-referrer');
  expect(response.body.toString()).toBe('0123456789');
});

test.each([
  ['bytes=2-5', 206, 'bytes 2-5/10', '2345'],
  ['bytes=7-', 206, 'bytes 7-9/10', '789'],
  ['bytes=-3', 206, 'bytes 7-9/10', '789'],
  ['bytes=99-', 416, 'bytes */10', null],
])('handles local seeking %s', async (range, status, contentRange, data) => {
  const response = await request(app).get(createMediaLink(localRef)).set('Range', range);
  expect(response.status).toBe(status);
  expect(response.headers['content-range']).toBe(contentRange);
  if (data) expect(response.body.toString()).toBe(data);
});

test('supports media metadata HEAD requests', async () => {
  const response = await request(app).head(createMediaLink(localRef));
  expect(response.status).toBe(200);
  expect(response.headers['content-length']).toBe('10');
  expect(response.text).toBeUndefined();
});

test.each([
  { expiresIn: '-1s' }, { subject: 'different-owner' }, { audience: 'another-app' },
])('rejects invalid temporary link constraints %j', async (overrides) => {
  const token = jwt.sign({ asset: localRef }, secret, { algorithm: 'HS256', issuer: 'aethercast',
    audience: 'library-media', subject: ownerId, expiresIn: '15m', ...overrides });
  expect((await request(app).get(`/media/${token}`)).status).toBe(401);
});

test('rejects forged links and traversal attempts', async () => {
  expect((await request(app).get('/media/invalid-token')).status).toBe(401);
  for (const key of ['../secret', '%2e%2e/secret', '%252e%252e/secret', 'folder\\secret', 'folder//secret']) {
    expect(() => parseMediaReference(`/uploads/${key}`)).toThrow();
  }
});

test('wraps nested API media fields without exposing permanent storage URLs', () => {
  const send = jest.fn();
  const res = { json: send, statusCode: 200, set: jest.fn() };
  privateMediaResponses({ user: { _id: 'owner' } }, res, jest.fn());
  res.json({ episodes: [{ audioUrl: localRef, podcastId: { coverImage: 'https://test.supabase.co/storage/v1/object/public/vox/covers/art.png' } }] });
  const result = send.mock.calls[0][0];
  expect(result.episodes[0].audioUrl).toMatch(/^\/media\//);
  expect(result.episodes[0].podcastId.coverImage).toMatch(/^\/media\//);
});

test('proxies cloud byte ranges without exposing storage credentials', async () => {
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(Response.json({ public: false }))
    .mockResolvedValueOnce(new Response(Buffer.from('2345'), { status: 206, headers: {
      'Content-Type': 'audio/mpeg', 'Content-Length': '4', 'Content-Range': 'bytes 2-5/10', 'Accept-Ranges': 'bytes',
    } }));
  const response = await request(app).get(createMediaLink('supabase://vox/audios/song.mp3')).set('Range', 'bytes=2-5');
  expect(response.status).toBe(206);
  expect(response.body.toString()).toBe('2345');
  expect(response.headers['content-range']).toBe('bytes 2-5/10');
  expect(fetchMock.mock.calls[1][0]).toBe('https://test.supabase.co/storage/v1/object/vox/audios/song.mp3');
  expect(fetchMock.mock.calls[1][1].headers.Range).toBe('bytes=2-5');
  expect(JSON.stringify(response.headers)).not.toContain('test-only-server-key');
});

test('refuses cloud playback when the configured bucket is public', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({ public: true }));
  const response = await request(app).get(createMediaLink('supabase://vox/audios/song.mp3'));
  expect(response.status).toBe(500);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('uploads into private storage using stable object references', async () => {
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(Response.json({ public: false }))
    .mockResolvedValueOnce(Response.json({ Key: 'stored' }));
  const reference = await uploadToSupabase(Buffer.from('audio'), 'song.mp3', 'audio/mpeg', 'audios');
  expect(reference).toMatch(/^supabase:\/\/vox\/audios\/[\w-]+\.mp3$/);
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer test-only-server-key');
});

test('preserves an unsatisfiable cloud range response', async () => {
  jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce(Response.json({ public: false }))
    .mockResolvedValueOnce(new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */10' } }));
  const response = await request(app).get(createMediaLink('supabase://vox/audios/song.mp3')).set('Range', 'bytes=99-');
  expect(response.status).toBe(416);
  expect(response.headers['content-range']).toBe('bytes */10');
});

test('refuses uploads into a public bucket before writing an object', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({ public: true }));
  await expect(uploadToSupabase(Buffer.from('audio'), 'song.mp3', 'audio/mpeg')).rejects.toThrow('must be private');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('failed cloud uploads never silently fall back to local disk', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce(Response.json({ public: false })).mockResolvedValueOnce(new Response(null, { status: 500 }));
  await expect(uploadToSupabase(Buffer.from('audio'), 'song.mp3', 'audio/mpeg')).rejects.toThrow('no local fallback');
  process.env.NODE_ENV = 'production';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await expect(uploadToSupabase(Buffer.from('audio'), 'song.mp3', 'audio/mpeg')).rejects.toThrow('server-only');
  expect(() => saveFileLocally({ originalname: 'song.mp3', buffer: Buffer.from('audio') })).toThrow('disabled in production');
});

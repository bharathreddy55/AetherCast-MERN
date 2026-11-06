const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const { protect } = require('../middlewares/auth');
const User = require('../models/User');

jest.mock('../models/User', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn(), findById: jest.fn(), create: jest.fn() }));

const originalEnv = { ...process.env };
const ownerId = '11111111-1111-4111-8111-111111111111';
const secret = 'test-only-secret';
const issuer = 'https://private-library.supabase.co/auth/v1';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OWNER_SUPABASE_USER_ID = ownerId;
  process.env.SUPABASE_URL = 'https://private-library.supabase.co';
  process.env.SUPABASE_JWT_SECRET = secret;
  User.findOne.mockResolvedValue({ _id: 'existing', supabaseUserId: ownerId, role: 'listener', accountStatus: 'active' });
});

afterAll(() => { process.env = originalEnv; });

const authenticate = async (claims = {}, options = {}) => {
  const token = jwt.sign({ sub: ownerId, email: 'owner@example.com', ...claims }, secret, {
    algorithm: 'HS256', issuer, audience: 'authenticated', expiresIn: '5m', ...options,
  });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await protect(req, res, next);
  return { req, res, next };
};

test('allows the explicitly configured owner', async () => {
  const { req, next } = await authenticate();
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user._id).toBe('existing');
});

test('legacy access-token cookies do not silently authorize a device', async () => {
  const token = jwt.sign({ sub: ownerId, email: 'owner@example.com' }, secret,
    { algorithm: 'HS256', issuer, audience: 'authenticated', expiresIn: '5m' });
  const response = await request(app).get('/api/auth/profile').set('Cookie', `accessToken=${token}`);
  expect(response.status).toBe(401);
  expect(User.findOne).not.toHaveBeenCalled();
});

test('denies another authenticated user before looking up a profile', async () => {
  const { res, next } = await authenticate({ sub: 'other-user' });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
  expect(User.findOne).not.toHaveBeenCalled();
});

test('denies access when owner configuration is missing', async () => {
  delete process.env.OWNER_SUPABASE_USER_ID;
  const { res, next } = await authenticate();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(next).not.toHaveBeenCalled();
});

test('does not allow a suspended owner', async () => {
  User.findOne.mockResolvedValue({ accountStatus: 'suspended' });
  const { res, next } = await authenticate();
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test.each([
  { issuer: 'https://another.supabase.co/auth/v1' },
  { audience: 'another-app' },
  { expiresIn: '-1s' },
])('rejects invalid token constraints: %j', async (options) => {
  const { res, next } = await authenticate({}, options);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('ignores administrator role supplied in editable metadata', async () => {
  User.findOne.mockResolvedValue(null);
  User.create.mockImplementation(async data => ({ _id: 'new', ...data }));
  const { req, next } = await authenticate({ user_metadata: { role: 'admin' } });
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user.role).toBe('listener');
});

test('links an existing email profile without replacing its library identity', async () => {
  const oldUser = { _id: 'existing-library-owner', role: 'creator', accountStatus: 'active' };
  User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(oldUser);
  User.findOneAndUpdate.mockResolvedValue({ ...oldUser, supabaseUserId: ownerId });
  const { req, next } = await authenticate();
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user._id).toBe(oldUser._id);
  expect(req.user.role).toBe('creator');
  expect(User.findOneAndUpdate).toHaveBeenCalledWith(
    { _id: oldUser._id, $or: [{ supabaseUserId: { $exists: false } }, { supabaseUserId: null }, { supabaseUserId: '' }] },
    { $set: { supabaseUserId: ownerId } },
    { new: true, runValidators: true, overwriteImmutable: true },
  );
  expect(User.create).not.toHaveBeenCalled();
});

test('rejects email migration if a profile is already bound to another identity', async () => {
  User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ supabaseUserId: 'different-identity' });
  const { res, next } = await authenticate();
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
  expect(User.findOneAndUpdate).not.toHaveBeenCalled();
});

test('uses the linked identity even if the owner email has changed', async () => {
  const { next } = await authenticate({ email: 'new-owner-email@example.com' });
  expect(next).toHaveBeenCalledTimes(1);
  expect(User.findOne).toHaveBeenCalledTimes(1);
  expect(User.findOne).toHaveBeenCalledWith({ supabaseUserId: ownerId });
});

test('new owner usernames are server-generated instead of reusing conflicting editable metadata', async () => {
  User.findOne.mockResolvedValue(null);
  User.create.mockImplementation(async data => ({ _id: 'new-owner', ...data }));
  const { req, next } = await authenticate({ user_metadata: { username: 'taken-username', role: 'admin' } });
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user.username).toMatch(/^owner-[a-f0-9]{32}$/);
  expect(req.user.username).not.toBe('taken-username');
  expect(req.user.role).toBe('listener');
});

test('concurrent first-login creation reuses the verified owner instead of failing on a duplicate', async () => {
  const linked = { _id: 'winning-owner-profile', supabaseUserId: ownerId, role: 'listener' };
  let created = false;
  User.findOne.mockImplementation(async query => created && query.supabaseUserId === ownerId ? linked : null);
  User.create.mockImplementation(async () => { created = true; throw Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { supabaseUserId: 1 } }); });
  const { req, next } = await authenticate();
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user._id).toBe(linked._id);
  expect(User.create).toHaveBeenCalledTimes(1);
});

test('a username collision generates a new name without adopting the unrelated username profile', async () => {
  User.findOne.mockResolvedValue(null);
  User.create.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { username: 1 } }))
    .mockImplementationOnce(async data => ({ _id: 'new-owner', ...data }));
  const { next } = await authenticate();
  expect(next).toHaveBeenCalledTimes(1);
  expect(User.create).toHaveBeenCalledTimes(2);
  expect(User.create.mock.calls[0][0].username).not.toBe(User.create.mock.calls[1][0].username);
  expect(User.findOne.mock.calls.some(([query]) => Object.hasOwn(query, 'username'))).toBe(false);
});

test('profile creation retries are bounded and never retry unknown conflicting indexes blindly', async () => {
  User.findOne.mockResolvedValue(null);
  User.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { username: 1 } }));
  const first = await authenticate();
  expect(first.res.status).toHaveBeenCalledWith(503);
  expect(User.create).toHaveBeenCalledTimes(3);
  User.create.mockClear().mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { googleId: 1 } }));
  const second = await authenticate();
  expect(second.res.status).toHaveBeenCalledWith(503);
  expect(User.create).toHaveBeenCalledTimes(1);
});

test('case-insensitive legacy email matching preserves the existing library ID and role', async () => {
  const old = { _id: 'legacy-library', role: 'creator', supabaseUserId: null };
  User.findOne.mockImplementation(async query => query.email instanceof RegExp && query.email.test('OWNER@EXAMPLE.COM') ? old : null);
  User.findOneAndUpdate.mockResolvedValue({ ...old, supabaseUserId: ownerId });
  const { req, next } = await authenticate({ email: 'Owner@Example.com' });
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user._id).toBe(old._id);
  expect(req.user.role).toBe('creator');
  expect(User.create).not.toHaveBeenCalled();
});

test('duplicate recovery does not adopt an email profile bound to a different identity', async () => {
  let attempted = false;
  User.findOne.mockImplementation(async query => attempted && query.email === 'owner@example.com' ? { _id: 'other', supabaseUserId: 'another-identity' } : null);
  User.create.mockImplementation(async () => { attempted = true; throw Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { email: 1 } }); });
  const { res, next } = await authenticate();
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
  expect(User.findOneAndUpdate).not.toHaveBeenCalled();
});

test('duplicate recovery still rejects a suspended owner profile', async () => {
  let attempted = false;
  User.findOne.mockImplementation(async () => attempted ? { _id: 'owner', supabaseUserId: ownerId, accountStatus: 'suspended' } : null);
  User.create.mockImplementation(async () => { attempted = true; throw Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { supabaseUserId: 1 } }); });
  const { res, next } = await authenticate();
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test('the profile HTTP route returns the newly provisioned owner after successful sign-in', async () => {
  User.findOne.mockResolvedValue(null);
  const profile = { _id: 'library-owner', id: 'library-owner', supabaseUserId: ownerId, role: 'listener' };
  User.create.mockResolvedValue(profile);
  User.findById.mockResolvedValue(profile);
  const token = jwt.sign({ sub: ownerId, email: 'owner@example.com', user_metadata: { username: 'already-used' } }, secret,
    { algorithm: 'HS256', issuer, audience: 'authenticated', expiresIn: '5m' });
  const response = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(200);
  expect(response.body.user._id).toBe(profile._id);
  expect(User.findById).toHaveBeenCalledWith(profile._id);
});

test('reports missing signing configuration as a server setup error', async () => {
  delete process.env.SUPABASE_JWT_SECRET;
  const { res, next } = await authenticate();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Server sign-in configuration') }));
  expect(next).not.toHaveBeenCalled();
  expect(User.findOne).not.toHaveBeenCalled();
});

test.each([
  Object.assign(new Error('private database connection details'), { name: 'MongoServerSelectionError' }),
  Object.assign(new Error('private duplicate profile details'), { code: 11000 }),
])('does not misreport profile storage errors as invalid passwords or tokens', async error => {
  User.findOne.mockRejectedValue(error);
  const { res, next } = await authenticate();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith({ success: false, message: expect.stringContaining('You signed in successfully') });
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('private');
  expect(next).not.toHaveBeenCalled();
});

test('reports first-login profile creation failure separately from valid token verification', async () => {
  User.findOne.mockResolvedValue(null);
  User.create.mockRejectedValue(Object.assign(new Error('private validation data'), { name: 'ValidationError' }));
  const { res, next } = await authenticate();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith({ success: false, message: expect.stringContaining('library profile could not be loaded') });
  expect(next).not.toHaveBeenCalled();
});

test.each(['register', 'login', 'google', 'verify-otp', 'resend-otp', 'refresh'])(
  'closes the legacy %s account flow', async (route) => {
    const response = await request(app).post(`/api/auth/${route}`).send({ role: 'admin' });
    expect(response.status).toBe(403);
    expect(User.create).not.toHaveBeenCalled();
  },
);

test.each([
  ['get', '/api/podcasts'],
  ['get', '/api/podcasts/example'],
  ['get', '/api/episodes'],
  ['get', '/api/episodes/example'],
  ['get', '/api/episodes/example/stream'],
  ['get', '/api/episodes/example/comments'],
  ['get', '/api/playlists'],
  ['get', '/api/recommendations'],
  ['post', '/api/episodes/example/play'],
  ['post', '/api/episodes/example/chat'],
  ['get', '/api/music/artists'],
  ['get', '/api/music/search?q=song'],
  ['get', '/api/music/tracks/507f1f77bcf86cd799439011/lyrics'],
  ['put', '/api/music/tracks/507f1f77bcf86cd799439011/lyrics'],
  ['delete', '/api/music/tracks/507f1f77bcf86cd799439011/lyrics'],
  ['get', '/api/music/library/recommendations'],
  ['get', '/api/music/library/recommendations/exclusions'],
  ['put', '/api/music/library/recommendations/exclusions/tracks/507f1f77bcf86cd799439011'],
  ['delete', '/api/music/library/recommendations/exclusions/507f1f77bcf86cd799439011'],
  ['get', '/api/music/albums'],
  ['get', '/api/music/tracks'],
  ['get', '/api/music/tracks/507f1f77bcf86cd799439011/playback'],
  ['get', '/api/music/assets/507f1f77bcf86cd799439011'],
  ['get', '/api/music/imports/config'],
  ['post', '/api/music/imports'],
  ['get', '/api/music/library/state'],
  ['get', '/api/music/library/likes'],
  ['put', '/api/music/library/likes/507f1f77bcf86cd799439011'],
  ['get', '/api/music/library/playlists'],
  ['post', '/api/music/library/playlists'],
  ['get', '/api/music/library/history'],
  ['get', '/api/music/library/saved/albums'],
  ['get', '/api/music/library/followed/artists'],
  ['put', '/api/music/library/events/11111111-1111-4111-8111-111111111111'],
  ['get', '/api/music/library/state'],
  ['get', '/api/music/library/likes'],
  ['put', '/api/music/library/likes/507f1f77bcf86cd799439011'],
  ['get', '/api/music/library/playlists'],
  ['post', '/api/music/library/playlists'],
  ['get', '/api/music/library/history'],
  ['get', '/api/music/library/saved/albums'],
  ['get', '/api/music/library/followed/artists'],
  ['put', '/api/music/library/events/11111111-1111-4111-8111-111111111111'],
])('blocks anonymous %s %s', async (method, route) => {
  const response = await request(app)[method](route);
  expect(response.status).toBe(401);
  expect(User.findOne).not.toHaveBeenCalled();
});

test.each(['/api/podcasts', '/api/music/search?q=song', '/api/music/tracks/507f1f77bcf86cd799439011/lyrics', '/api/music/library/recommendations', '/api/music/library/recommendations/exclusions'])('blocks a signed-in non-owner from browsing %s', async route => {
  const token = jwt.sign({ sub: 'another-user', email: 'another@example.com' }, secret, {
    algorithm: 'HS256', issuer, audience: 'authenticated', expiresIn: '5m',
  });
  const response = await request(app).get(route).set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(403);
  expect(User.findOne).not.toHaveBeenCalled();
});

test('owner search requests reach strict query validation', async () => {
  const token = jwt.sign({ sub: ownerId, email: 'owner@example.com' }, secret, {
    algorithm: 'HS256', issuer, audience: 'authenticated', expiresIn: '5m',
  });
  const result = await request(app).get('/api/music/search?q=song&ownerId=another').set('Authorization', `Bearer ${token}`);
  expect(result.status).toBe(400);
  expect(result.body.message).toBe('Unsupported music search filter');
});

test('owner requests with malformed music identifiers are rejected before database lookup', async () => {
  const token = jwt.sign({ sub: ownerId, email: 'owner@example.com' }, secret, {
    algorithm: 'HS256', issuer, audience: 'authenticated', expiresIn: '5m',
  });
  const result = await request(app).get('/api/music/tracks/not-an-id').set('Authorization', `Bearer ${token}`);
  expect(result.status).toBe(400);
  expect(result.body.message).toBe('Invalid music record ID');
});

test('music upload routes reject disguised content after owner authentication', async () => {
  const token = jwt.sign({ sub: ownerId, email: 'owner@example.com' }, secret, {
    algorithm: 'HS256', issuer, audience: 'authenticated', expiresIn: '5m',
  });
  const result = await request(app).post('/api/music/imports').set('Authorization', `Bearer ${token}`)
    .attach('audio', Buffer.from('this is not an audio file'), 'pretend.mp3');
  expect(result.status).toBe(400);
  expect(result.body.message).toContain('contents');
});

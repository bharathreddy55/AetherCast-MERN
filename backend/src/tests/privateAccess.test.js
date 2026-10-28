const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const { protect } = require('../middlewares/auth');
const User = require('../models/User');

jest.mock('../models/User', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn(), create: jest.fn() }));

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
    { _id: oldUser._id, supabaseUserId: { $exists: false } },
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
])('blocks anonymous %s %s', async (method, route) => {
  const response = await request(app)[method](route);
  expect(response.status).toBe(401);
  expect(User.findOne).not.toHaveBeenCalled();
});

test('blocks a signed-in non-owner from browsing the catalog', async () => {
  const token = jwt.sign({ sub: 'another-user', email: 'another@example.com' }, secret, {
    algorithm: 'HS256', issuer, audience: 'authenticated', expiresIn: '5m',
  });
  const response = await request(app).get('/api/podcasts').set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(403);
  expect(User.findOne).not.toHaveBeenCalled();
});

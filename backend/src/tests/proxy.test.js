const express = require('express');
const request = require('supertest');
const { rateLimit } = require('express-rate-limit');
const { trustedProxyHops } = require('../config/proxy');

test('Render defaults to one trusted proxy hop; direct hosting trusts none', () => {
  expect(trustedProxyHops({ RENDER: 'true' })).toBe(1);
  expect(trustedProxyHops({ NODE_ENV: 'production' })).toBe(0);
  expect(trustedProxyHops({})).toBe(0);
  expect(trustedProxyHops({ RENDER: 'true', TRUST_PROXY_HOPS: '0' })).toBe(0);
  expect(trustedProxyHops({ TRUST_PROXY_HOPS: '2' })).toBe(2);
});

test.each(['true', '-1', '6', '1.5', '*', '1,2'])('rejects unsafe or malformed proxy hop setting %s', value => {
  expect(() => trustedProxyHops({ TRUST_PROXY_HOPS: value })).toThrow('TRUST_PROXY_HOPS');
});

test('proxied clients get separate rate limits and forged earlier headers do not bypass them', async () => {
  const app = express();
  app.set('trust proxy', trustedProxyHops({ RENDER: 'true' }));
  app.use(rateLimit({ windowMs: 60000, max: 1, standardHeaders: true, legacyHeaders: false }));
  app.get('/', (req, res) => res.json({ ip: req.ip }));
  const first = await request(app).get('/').set('X-Forwarded-For', '198.51.100.1');
  const second = await request(app).get('/').set('X-Forwarded-For', '198.51.100.2');
  const forged = await request(app).get('/').set('X-Forwarded-For', '203.0.113.99, 198.51.100.1');
  expect(first.status).toBe(200);
  expect(first.body.ip).toBe('198.51.100.1');
  expect(second.status).toBe(200);
  expect(forged.status).toBe(429);
});

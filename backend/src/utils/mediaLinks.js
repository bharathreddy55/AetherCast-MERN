const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { parseMediaReference } = require('./mediaReferences');

const developmentSecret = crypto.randomBytes(32).toString('hex');
const mediaFields = new Set(['audioUrl', 'coverImage', 'bannerImage', 'avatar']);
const getMediaSecret = () => {
  const secret = process.env.MEDIA_SIGNING_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== 'production' && !secret) return developmentSecret;
  throw new Error('MEDIA_SIGNING_SECRET must contain at least 32 characters');
};

function createMediaLink(reference) {
  const asset = parseMediaReference(reference);
  if (!asset) return reference;
  if (!process.env.OWNER_SUPABASE_USER_ID) throw new Error('Private library owner is not configured');
  const token = jwt.sign({ asset: asset.reference }, getMediaSecret(), {
    algorithm: 'HS256', issuer: 'aethercast', audience: 'library-media',
    subject: process.env.OWNER_SUPABASE_USER_ID, expiresIn: '15m',
  });
  return `/media/${token}`;
}

function verifyMediaLink(token) {
  const payload = jwt.verify(token, getMediaSecret(), {
    algorithms: ['HS256'], issuer: 'aethercast', audience: 'library-media',
    subject: process.env.OWNER_SUPABASE_USER_ID,
  });
  if (!process.env.OWNER_SUPABASE_USER_ID || !Number.isFinite(payload.exp)) throw new Error('Invalid media access');
  const asset = parseMediaReference(payload.asset);
  if (!asset) throw new Error('Invalid media reference');
  return asset;
}

// Convert all populated API media fields at the boundary; database references
// stay stable. Temporary links are scoped capabilities, not account tokens.
function privateMediaResponses(req, res, next) {
  const originalJson = res.json;
  res.json = function (body) {
    if (!req.user || res.statusCode >= 400) return originalJson.call(this, body);
    const output = JSON.parse(JSON.stringify(body, (key, value) => mediaFields.has(key) ? createMediaLink(value) : value));
    res.set('Cache-Control', 'private, no-store');
    return originalJson.call(this, output);
  };
  next();
}

module.exports = { createMediaLink, verifyMediaLink, privateMediaResponses, getMediaSecret };

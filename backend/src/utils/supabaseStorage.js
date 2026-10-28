const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { uploadsRoot } = require('./mediaReferences');

const objectPath = (bucket, key) => [bucket, ...key.split('/')].map(encodeURIComponent).join('/');

function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Private storage requires SUPABASE_URL and a server-only SUPABASE_SERVICE_ROLE_KEY');
  return {
    url, bucket: process.env.SUPABASE_STORAGE_BUCKET || 'vox',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  };
}

async function assertPrivateBucket(config) {
  const response = await fetch(`${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`, {
    headers: config.headers, signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  if (!response.ok) throw new Error('Unable to verify private media storage configuration');
  const bucket = await response.json();
  if (bucket.public !== false) throw new Error('Media storage bucket must be private before uploading or streaming');
}

async function uploadToSupabase(fileBuffer, originalName, mimeType, folder = 'uploads') {
  // Development without cloud credentials uses local files. Configured cloud
  // uploads never fall back on failure; production always requires cloud storage.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NODE_ENV !== 'production') return null;
  const config = storageConfig();
  await assertPrivateBucket(config);
  if (!/^[a-zA-Z0-9_-]+$/.test(folder)) throw new Error('Invalid upload folder');
  const key = `${folder}/${crypto.randomUUID()}${path.extname(originalName).toLowerCase()}`;
  const response = await fetch(`${config.url}/storage/v1/object/${objectPath(config.bucket, key)}`, {
    method: 'POST', headers: { ...config.headers, 'Content-Type': mimeType, 'x-upsert': 'false' },
    body: fileBuffer, signal: AbortSignal.timeout(120000), redirect: 'error',
  });
  if (!response.ok) throw new Error('Private media upload failed. Please retry; no local fallback was used.');
  return `supabase://${config.bucket}/${key}`;
}

function saveFileLocally(file) {
  if (process.env.NODE_ENV === 'production') throw new Error('Local media storage is disabled in production');
  fs.mkdirSync(uploadsRoot, { recursive: true });
  const filename = `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
  fs.writeFileSync(path.join(uploadsRoot, filename), file.buffer);
  return `/uploads/${filename}`;
}

module.exports = { uploadToSupabase, saveFileLocally, storageConfig, assertPrivateBucket, objectPath };

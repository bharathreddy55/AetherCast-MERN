const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const MediaAsset = require('../models/MediaAsset');
const { uploadToSupabase, saveFileLocally, storageConfig, assertPrivateBucket, objectPath } = require('../utils/supabaseStorage');
const { parseMediaReference, uploadsRoot } = require('../utils/mediaReferences');
const { assetReference } = require('../utils/musicCatalog');

async function localPath(key) {
  const root = await fs.realpath(uploadsRoot);
  const file = await fs.realpath(path.join(root, key));
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid local import source');
  return file;
}
async function discardNewObject(reference) {
  const asset = parseMediaReference(reference);
  if (!asset) throw new Error('Invalid import object');
  if (asset.type === 'local') return fs.unlink(await localPath(asset.key));
  const config = storageConfig();
  await assertPrivateBucket(config);
  const result = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(asset.bucket)}`, {
    method: 'DELETE', headers: { ...config.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [asset.key] }), signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  if (!result.ok) throw new Error('Import object cleanup needs attention');
}
async function storeImportAsset(ownerId, bytes, originalName, details) {
  const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
  const existing = await MediaAsset.findOne({ ownerId, checksum });
  if (existing) return existing;
  const reference = await uploadToSupabase(bytes, originalName, details.mimeType, details.kind === 'image' ? 'music-artwork' : 'music-originals')
    || saveFileLocally({ buffer: bytes, originalname: originalName });
  const parsed = parseMediaReference(reference);
  try {
    return await MediaAsset.create({ ownerId, checksum, originalName, byteSize: bytes.length,
      storageProvider: parsed.type, bucket: parsed.bucket || '', objectKey: parsed.key, ...details });
  } catch (error) {
    try { await discardNewObject(reference); } catch { console.warn('An abandoned music import object needs storage cleanup.'); }
    if (error.code === 11000) {
      const duplicate = await MediaAsset.findOne({ ownerId, checksum });
      if (duplicate) return duplicate;
    }
    throw error;
  }
}
async function readImportAsset(asset, maxBytes) {
  const reference = parseMediaReference(assetReference(asset));
  if (!reference || asset.byteSize > maxBytes) throw new Error('Import source exceeds the file limit');
  if (reference.type === 'local') {
    const file = await localPath(reference.key);
    if ((await fs.stat(file)).size > maxBytes) throw new Error('Import source exceeds the file limit');
    return fs.readFile(file);
  }
  const config = storageConfig();
  await assertPrivateBucket(config);
  const response = await fetch(`${config.url}/storage/v1/object/${objectPath(reference.bucket, reference.key)}`, {
    headers: { ...config.headers, 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(30000), redirect: 'error',
  });
  if (!response.ok || !response.body) throw new Error('Import source is unavailable');
  const parts = [];
  let size = 0;
  for await (const part of response.body) {
    size += part.length;
    if (size > maxBytes) throw new Error('Import source exceeds the file limit');
    parts.push(Buffer.from(part));
  }
  return Buffer.concat(parts);
}
module.exports = { storeImportAsset, readImportAsset };

const DAY_MS = 86400000;
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
function storageAliasFilter(asset) {
  const key = asset.objectKey;
  if (!validId(String(asset._id)) || typeof key !== 'string' || !key || key.length > 1024
    || /[\\%?#\x00-\x1f\x7f]/.test(key) || key.split('/').some(part => !part || part === '.' || part === '..')) return null;
  const identity = { storageProvider: asset.storageProvider, objectKey: key };
  if (asset.storageProvider === 'supabase') {
    if (typeof asset.bucket !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(asset.bucket)) return null;
    identity.bucket = asset.bucket;
  } else if (asset.storageProvider !== 'local') return null;
  // Deliberately global: another owner's alias must also protect the object.
  // exists() returns only an internal ID; no other-owner data enters the report.
  return { _id: { $ne: asset._id }, ...identity };
}
function retentionOptions(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['limit', 'after', 'retentionDays'].includes(key))) throw new Error('Unsupported retention options');
  const { limit = 50, after = '', retentionDays = 30 } = input;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(retentionDays) || retentionDays < 30 || retentionDays > 3650 || (after !== '' && !validId(after))) throw new Error('Invalid retention options');
  return { limit, after, retentionDays };
}
function retentionItem(asset, references, now, retentionDays) {
  const reasons = [...new Set(references)].sort();
  const sizeValid = Number.isSafeInteger(asset.byteSize) && asset.byteSize > 0;
  const created = asset.createdAt ? new Date(asset.createdAt).getTime() : NaN;
  const updated = asset.updatedAt ? new Date(asset.updatedAt).getTime() : NaN;
  const datesValid = Number.isFinite(created) && Number.isFinite(updated) && updated >= created && created <= now && updated <= now;
  const sourceValid = validId(String(asset.originalAssetId)) && String(asset.originalAssetId) !== String(asset._id);
  const ageDays = datesValid ? Math.floor((now - Math.max(created, updated)) / DAY_MS) : null;
  let category;
  if (!asset.originalAssetId) { category = 'original'; reasons.push('original-or-unclassified-media'); }
  else if (reasons.length) category = 'protected';
  else if (!sourceValid || !datesValid || !sizeValid || !['audio', 'image'].includes(asset.kind) || asset.status !== 'ready') {
    category = 'retained'; reasons.push('incomplete-or-invalid-metadata');
  } else if (ageDays < retentionDays) { category = 'retained'; reasons.push('within-retention-period'); }
  else { category = 'review'; reasons.push('older-derivative-with-no-observed-owner-reference'); }
  return { assetId: String(asset._id), kind: ['audio', 'image'].includes(asset.kind) ? asset.kind : 'unknown',
    status: ['pending', 'processing', 'ready', 'failed'].includes(asset.status) ? asset.status : 'unknown',
    byteSize: sizeValid ? asset.byteSize : null, ageDays, category, reasons };
}
module.exports = { retentionOptions, retentionItem, storageAliasFilter };

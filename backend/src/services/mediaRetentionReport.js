const MediaAsset = require('../models/MediaAsset');
const Track = require('../models/Track');
const Album = require('../models/Album');
const Artist = require('../models/Artist');
const MusicImport = require('../models/MusicImport');
const MediaProcessingJob = require('../models/MediaProcessingJob');
const { retentionOptions, retentionItem } = require('../utils/mediaRetention');
const MAX_QUERY_MS = 5000;
const referenceFields = [
  [Track, 'audioAssetId', 'track-audio'], [Track, 'coverAssetId', 'track-cover'],
  [Album, 'coverAssetId', 'album-cover'], [Artist, 'imageAssetId', 'artist-image'],
  [MusicImport, 'assetId', 'import-audio'], [MusicImport, 'coverAssetId', 'import-cover'],
  [MediaProcessingJob, 'sourceAssetId', 'processing-source'], [MediaProcessingJob, 'outputAssetId', 'processing-output'],
  [MediaAsset, 'originalAssetId', 'derivative-source'], [MediaAsset, 'thumbnailAssetId', 'artwork-thumbnail'],
];

async function mediaRetentionReport(ownerId, input = {}, { now = new Date() } = {}) {
  const options = retentionOptions(input);
  if (!/^[a-f0-9]{24}$/i.test(String(ownerId)) || !Number.isFinite(new Date(now).getTime())) throw new Error('Invalid retention report identity or time');
  const filter = { ownerId, ...(options.after ? { _id: { $gt: options.after } } : {}) };
  const records = await MediaAsset.find(filter)
    .select('_id kind status byteSize originalAssetId createdAt updatedAt').sort({ _id: 1 }).limit(options.limit + 1).maxTimeMS(MAX_QUERY_MS).lean();
  const page = records.slice(0, options.limit), ids = page.map(asset => asset._id);
  const references = new Map(ids.map(value => [String(value), []]));
  if (ids.length) {
    // Keep references from every status, including soft-deleted records and failed/
    // cancelled jobs: retries and restoration can still need those objects.
    const parentIds = [...new Set(page.filter(asset => asset.originalAssetId).map(asset => String(asset.originalAssetId)))].filter(value => /^[a-f0-9]{24}$/i.test(value));
    const results = await Promise.all([
      ...referenceFields.map(([model, field]) => model.distinct(field, { ownerId, [field]: { $in: ids } }).maxTimeMS(MAX_QUERY_MS)),
      parentIds.length ? MediaProcessingJob.distinct('sourceAssetId', { ownerId, sourceAssetId: { $in: parentIds }, status: { $in: ['queued', 'processing'] } }).maxTimeMS(MAX_QUERY_MS) : [],
    ]);
    referenceFields.forEach(([, , label], index) => {
      for (const id of results[index]) references.get(String(id))?.push(label);
    });
    const busySources = new Set(results.at(-1).map(String));
    for (const asset of page) if (asset.originalAssetId && busySources.has(String(asset.originalAssetId))) references.get(String(asset._id)).push('source-job-in-progress');
  }
  const asOf = new Date(now);
  const items = page.map(asset => retentionItem(asset, references.get(String(asset._id)), asOf.getTime(), options.retentionDays));
  const summary = { scanned: items.length, original: 0, protected: 0, retained: 0, review: 0, knownBytes: 0, reviewBytes: 0, unknownSize: 0 };
  for (const item of items) {
    summary[item.category]++;
    if (item.byteSize === null) summary.unknownSize++;
    else {
      summary.knownBytes += item.byteSize;
      if (item.category === 'review') summary.reviewBytes += item.byteSize;
      if (!Number.isSafeInteger(summary.knownBytes) || !Number.isSafeInteger(summary.reviewBytes)) throw new Error('Retention byte totals exceed the supported range');
    }
  }
  return { version: 1, mode: 'review-only', deletionSupported: false, asOf: asOf.toISOString(), retentionDays: options.retentionDays,
    scope: 'owner-page', summary, items, nextCursor: records.length > options.limit ? String(page.at(-1)._id) : null,
    limitations: ['Live database reference observations are not an atomic snapshot or deletion approval.',
      'Object existence, storage aliases, cross-owner/legacy URL references and unregistered storage objects are not assessed.',
      'Byte totals describe this page of asset records, can double-count shared objects and are not physical storage usage.',
      'Originals and all observed references are retained. Review entries need separate storage and reference checks before any future purge.'] };
}
module.exports = { mediaRetentionReport };

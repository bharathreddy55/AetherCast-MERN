const fs = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { verifyMediaLink } = require('../utils/mediaLinks');
const { uploadsRoot } = require('../utils/mediaReferences');
const { storageConfig, assertPrivateBucket, objectPath } = require('../utils/supabaseStorage');

exports.deliverMedia = async (req, res, next) => {
  res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
  let asset;
  try { asset = verifyMediaLink(req.params.token); }
  catch { return res.status(401).json({ success: false, message: 'Media link expired or invalid. Refresh the library to try again.' }); }
  try {
    if (asset.type === 'local') {
      const realRoot = await fs.realpath(uploadsRoot);
      const file = await fs.realpath(path.join(realRoot, asset.key));
      const relative = path.relative(realRoot, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return res.sendStatus(403);
      return res.sendFile(file, { cacheControl: false, lastModified: false, dotfiles: 'deny' }, (error) => {
        if (error) next(error);
      });
    }
    const config = storageConfig();
    await assertPrivateBucket(config);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const onClose = () => controller.abort();
    res.on('close', onClose);
    try {
      const headers = { ...config.headers, 'Accept-Encoding': 'identity' };
      if (req.headers.range) headers.Range = req.headers.range;
      const upstream = await fetch(`${config.url}/storage/v1/object/${objectPath(asset.bucket, asset.key)}`, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers, signal: controller.signal, redirect: 'error',
      });
      clearTimeout(timeout);
      if (![200, 206, 416].includes(upstream.status)) {
        await upstream.body?.cancel();
        return res.status(upstream.status === 404 ? 404 : 502).json({ success: false, message: 'Private media is unavailable.' });
      }
      for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        if (upstream.headers.has(header)) res.set(header, upstream.headers.get(header));
      }
      res.status(upstream.status);
      if (req.method === 'HEAD' || upstream.status === 416 || !upstream.body) {
        await upstream.body?.cancel();
        return res.end();
      }
      await pipeline(Readable.fromWeb(upstream.body), res);
    } finally {
      clearTimeout(timeout);
      res.off('close', onClose);
    }
  } catch (error) {
    if (res.headersSent) return res.destroy();
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Media file not found.' });
    next(error);
  }
};

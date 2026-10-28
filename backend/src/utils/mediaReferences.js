const path = require('path');

const uploadsRoot = path.resolve(__dirname, '../../uploads');
const cleanKey = (value) => {
  const key = decodeURIComponent(value);
  if (!key || /[\\%\x00-\x1f\x7f]/.test(key) || key.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid media object key');
  }
  return key;
};

function parseMediaReference(value) {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('/uploads/')) {
    const key = cleanKey(value.slice('/uploads/'.length));
    return { type: 'local', key, reference: `/uploads/${key}` };
  }
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'vox';
  let key;
  if (value.startsWith(`supabase://${bucket}/`)) {
    key = value.slice(`supabase://${bucket}/`.length);
  } else if (process.env.SUPABASE_URL) {
    // Interpret existing URLs as object references, never as arbitrary fetch targets.
    const prefix = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/`;
    if (value.startsWith(prefix)) key = value.slice(prefix.length).split('?')[0];
  }
  if (key === undefined) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(bucket)) throw new Error('Invalid storage bucket');
  key = cleanKey(key);
  return { type: 'supabase', bucket, key, reference: `supabase://${bucket}/${key}` };
}

module.exports = { parseMediaReference, uploadsRoot };

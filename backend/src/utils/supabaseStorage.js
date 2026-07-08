const fs = require('fs');
const path = require('path');

/**
 * Uploads a file buffer to Supabase storage.
 * @param {Buffer} fileBuffer The raw file buffer
 * @param {string} originalName The original file name
 * @param {string} mimeType The file mime type
 * @param {string} folder The bucket sub-folder ('covers', 'banners', 'audios', 'avatars')
 * @returns {Promise<string|null>} The public CDN URL of the uploaded asset, or null if failed/not configured
 */
const uploadToSupabase = async (fileBuffer, originalName, mimeType, folder = 'uploads') => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null; // Fallback to local storage
  }

  const cleanUrl = supabaseUrl.replace(/\/$/, '');
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'vox';
  
  // Clean filename: timestamp + alphanumeric
  const cleanExt = path.extname(originalName).toLowerCase();
  const cleanBase = path.basename(originalName, cleanExt).replace(/[^a-zA-Z0-9]/g, '_');
  const filePath = `${folder}/${Date.now()}-${cleanBase}${cleanExt}`;
  
  const uploadUrl = `${cleanUrl}/storage/v1/object/${bucketName}/${filePath}`;

  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': mimeType,
      },
      body: fileBuffer,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Supabase Storage Upload failed with status ${res.status}: ${errText}. Falling back to local filesystem.`);
      return null;
    }

    // Return the public URL
    return `${cleanUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
  } catch (err) {
    console.warn(`Supabase Storage Fetch Exception: ${err.message}. Falling back to local filesystem.`);
    return null;
  }
};

/**
 * Helper to write buffer to local file system when Supabase is not configured.
 * @param {object} file Multer file object
 * @param {string} folder Local sub-folder inside workspace
 * @returns {string} The public local URL path (e.g. /uploads/filename.mp3)
 */
const saveFileLocally = (file, folder = 'uploads') => {
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const cleanExt = path.extname(file.originalname).toLowerCase();
  const cleanBase = path.basename(file.originalname, cleanExt).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${cleanExt}`;
  const filePath = path.join(uploadDir, filename);

  fs.writeFileSync(filePath, file.buffer);
  return `/uploads/${filename}`;
};

module.exports = {
  uploadToSupabase,
  saveFileLocally
};

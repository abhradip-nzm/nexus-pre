/**
 * Cloudflare R2 storage utility
 * S3-compatible via @aws-sdk/client-s3
 *
 * Required env vars:
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 API token access key
 *   R2_SECRET_ACCESS_KEY— R2 API token secret key
 *   R2_BUCKET_NAME      — R2 bucket name
 *   R2_PUBLIC_URL       — Public bucket URL (e.g. https://pub-xxx.r2.dev or custom domain)
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

let _client = null;

function getClient() {
  if (_client) return _client;

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.warn('[Storage] R2 not configured — file uploads will be disabled.');
    return null;
  }

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return _client;
}

const BUCKET = () => process.env.R2_BUCKET_NAME || 'nexuspre';
const PUBLIC_URL = () => (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const ALLOWED_TYPES = {
  'image/jpeg':                  'jpg',
  'image/png':                   'png',
  'image/webp':                  'webp',
  'image/gif':                   'gif',
  'application/pdf':             'pdf',
  'application/msword':          'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel':    'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain':                  'txt',
  'text/csv':                    'csv',
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Upload a file buffer to R2.
 * @param {Buffer} buffer
 * @param {string} folder  — e.g. 'avatars', 'attachments'
 * @param {string} originalName — original filename (for extension)
 * @param {string} contentType  — MIME type
 * @returns {Promise<{ url: string, key: string }>}
 */
async function uploadFile(buffer, folder, originalName, contentType) {
  const client = getClient();
  if (!client) throw new Error('Storage not configured');

  if (!ALLOWED_TYPES[contentType]) {
    throw new Error(`File type ${contentType} is not allowed`);
  }
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error(`File exceeds 10 MB limit`);
  }

  const ext = ALLOWED_TYPES[contentType] || path.extname(originalName).slice(1) || 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key = `${folder}/${timestamp}-${random}.${ext}`;

  await client.send(new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  const url = `${PUBLIC_URL()}/${key}`;
  return { url, key };
}

/**
 * Delete a file from R2 by key.
 * @param {string} key
 */
async function deleteFile(key) {
  const client = getClient();
  if (!client) return;

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: BUCKET(),
      Key: key,
    }));
  } catch (err) {
    console.error('[Storage] Delete error:', err.message);
  }
}

/**
 * Extract R2 key from a full public URL.
 * Returns null if it doesn't match R2_PUBLIC_URL.
 */
function keyFromUrl(url) {
  const base = PUBLIC_URL();
  if (!base || !url || !url.startsWith(base)) return null;
  return url.slice(base.length + 1);
}

module.exports = { uploadFile, deleteFile, keyFromUrl, ALLOWED_TYPES, MAX_SIZE_BYTES };

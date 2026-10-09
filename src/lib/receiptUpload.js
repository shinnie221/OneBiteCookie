/**
 * Receipt / screenshot upload helper.
 * Images are compressed in the browser, then sent to our own API route
 * (/api/receipts/upload), which forwards them to the team Google Drive folder.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('无法读取图片文件'));
    reader.readAsDataURL(blob);
  });
}

// Downscale large phone photos so uploads stay fast on mobile data.
async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // Browser can't decode (e.g. HEIC) – upload the original
  }
}

/**
 * Uploads a receipt image to Google Drive.
 * @param {File} file
 * @param {Function} authFetch - authenticated fetch from AuthContext
 * @param {string} [label] - human-readable prefix for the Drive file name
 * @returns {Promise<string>} Google Drive file view URL
 */
export async function uploadReceipt(file, authFetch, label = 'receipt') {
  if (!file) throw new Error('请选择图片');
  const processed = await compressImage(file);
  const dataUrl = await readAsDataUrl(processed);
  const [, base64 = ''] = String(dataUrl).split(',');
  const mimeType = processed.type || file.type || 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('pdf') ? 'pdf' : 'jpg';

  const res = await authFetch('/api/receipts/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: `${label}_${Date.now()}.${ext}`, mimeType, data: base64 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || '上传到 Google Drive 失败，请重试');
  return data.url;
}

/** Extracts a Google Drive file id from common share-link formats. */
export function driveFileId(url) {
  if (!url || !url.includes('drive.google.com')) return null;
  const match = url.match(/\/file\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  return match ? match[1] : null;
}

/** Returns a URL usable in <img src>. Drive files use the thumbnail endpoint. */
export function receiptPreviewUrl(url) {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : url;
}

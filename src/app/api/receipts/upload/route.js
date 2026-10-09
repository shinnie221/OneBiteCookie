import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

// ~10 MB of base64 – phone photos are compressed client-side well below this.
const MAX_BASE64_LENGTH = 14_000_000;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

/**
 * Forwards a receipt image to the Google Apps Script web app that saves it
 * into the team's shared Google Drive receipts folder.
 * Required env vars: GOOGLE_DRIVE_UPLOAD_URL, GOOGLE_DRIVE_UPLOAD_SECRET
 */
export async function POST(request) {
  const user = verifyAuth(request);
  if (!user || !['staff', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
  }

  const scriptUrl = process.env.GOOGLE_DRIVE_UPLOAD_URL;
  const secret = process.env.GOOGLE_DRIVE_UPLOAD_SECRET;
  if (!scriptUrl || !secret) {
    return NextResponse.json({ error: 'Google Drive 上传尚未配置 (缺少 GOOGLE_DRIVE_UPLOAD_URL / GOOGLE_DRIVE_UPLOAD_SECRET)' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { data, mimeType = 'image/jpeg' } = body || {};
  if (typeof data !== 'string' || !data || data.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: '图片为空或过大 (上限约 10MB)' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return NextResponse.json({ error: '仅支持图片或 PDF 文件' }, { status: 400 });
  }

  // Keep Drive file names readable but safe
  const fileName = String(body.fileName || `receipt_${Date.now()}.jpg`)
    .replace(/[\\/:*?"<>|\r\n]+/g, '_')
    .slice(0, 150);

  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, fileName, mimeType, data, uploadedBy: user.name || user.email || 'staff' }),
      redirect: 'follow', // Apps Script responds via a 302 to googleusercontent.com
    });
    const result = await res.json().catch(() => null);
    if (!result?.ok || !result.url) {
      console.error('Drive upload failed:', result);
      return NextResponse.json({ error: result?.error || 'Google Drive 上传失败' }, { status: 502 });
    }
    return NextResponse.json({ url: result.url, id: result.id });
  } catch (error) {
    console.error('POST /api/receipts/upload error:', error);
    return NextResponse.json({ error: '无法连接 Google Drive，请稍后重试' }, { status: 502 });
  }
}

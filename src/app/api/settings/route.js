import { getDb, queryAll, queryOne, runStmt } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const db = await getDb();
    const settings = queryAll(db, 'SELECT * FROM settings');
    
    const settingsObj = {};
    for (const row of settings) {
      settingsObj[row.key] = row.value;
    }
    
    return NextResponse.json({ settings: settingsObj });
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = await getDb();
    const body = await request.json();
    
    for (const [key, value] of Object.entries(body)) {
      const existing = queryOne(db, 'SELECT key FROM settings WHERE key = ?', [key]);
      if (existing) {
        runStmt(db, 'UPDATE settings SET value = ? WHERE key = ?', [value, key]);
      } else {
        runStmt(db, 'INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
      }
    }
    
    return NextResponse.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

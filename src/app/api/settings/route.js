import { rtdb as db } from '@/lib/firebase';
import { ref, get, update } from 'firebase/database';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const snapshot = await get(ref(db, 'settings'));
    let settingsObj = {};
    if (snapshot.exists()) {
      settingsObj = snapshot.val();
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
    
    const body = await request.json();
    await update(ref(db, 'settings'), body);
    
    return NextResponse.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

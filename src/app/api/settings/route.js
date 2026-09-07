import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const docRef = doc(db, 'settings', 'store_settings');
    const snapshot = await getDoc(docRef);
    let settingsObj = {};
    if (snapshot.exists()) {
      settingsObj = snapshot.data();
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
    const docRef = doc(db, 'settings', 'store_settings');
    
    // We use setDoc with { merge: true } which acts like update in RTDB
    await setDoc(docRef, body, { merge: true });
    
    return NextResponse.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

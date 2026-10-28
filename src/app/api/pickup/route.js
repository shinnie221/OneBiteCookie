import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';
import { getPickupDetails } from '@/lib/pickupSettings';

// Lightweight public endpoint for the store pickup point.
// Reads the pickup fields from store_settings so customers don't
// download the full settings doc (banner/avatar data URLs).
export async function GET() {
  try {
    const snapshot = await getDoc(doc(db, 'settings', 'store_settings'));
    return NextResponse.json({ pickup: getPickupDetails(snapshot.exists() ? snapshot.data() : {}) });
  } catch (error) {
    console.error('GET /api/pickup error:', error);
    return NextResponse.json({ error: 'Failed to fetch pickup details' }, { status: 500 });
  }
}

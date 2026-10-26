import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';

// Lightweight public endpoint for the storefront announcement bar.
// Reads the announcement fields from store_settings so customers don't
// download the full settings doc (banner/avatar data URLs) on every page.
export async function GET() {
  try {
    const snapshot = await getDoc(doc(db, 'settings', 'store_settings'));
    const s = snapshot.exists() ? snapshot.data() : {};

    return NextResponse.json({
      announcement: {
        enabled: Boolean(s.announcement_enabled),
        text: s.announcement_text || '',
        link: s.announcement_link || '',
        updated_at: s.announcement_updated_at || null,
      },
    });
  } catch (error) {
    console.error('GET /api/announcement error:', error);
    return NextResponse.json({ error: 'Failed to fetch announcement' }, { status: 500 });
  }
}

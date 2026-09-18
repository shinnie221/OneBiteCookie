import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { validatePhone } from '@/lib/addresses.mjs';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const authUser = verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userDocRef = doc(db, 'users', authUser.id);
    const snapshot = await getDoc(userDocRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const data = snapshot.data();
    const safeUser = {
      id: snapshot.id,
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      addresses: Array.isArray(data.addresses) ? data.addresses : [],
      role: data.role || 'customer'
    };

    return NextResponse.json({ user: safeUser });
  } catch (error) {
    console.error('GET /api/user/profile error:', error);
    return NextResponse.json({ error: `Failed to load profile: ${error.message}` }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const authUser = verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = (body.name || '').trim();
    const phone = (body.phone || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (phone && !validatePhone(phone)) {
      return NextResponse.json({ error: 'Please provide a valid phone number (e.g. 012-345 6789 or +60123456789)' }, { status: 400 });
    }

    const userDocRef = doc(db, 'users', authUser.id);
    const snapshot = await getDoc(userDocRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const existingData = snapshot.data();
    const updatedFields = {
      name,
      phone,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(userDocRef, updatedFields);

    const safeUser = {
      id: snapshot.id,
      name,
      email: existingData.email || '',
      phone,
      addresses: Array.isArray(existingData.addresses) ? existingData.addresses : [],
      role: existingData.role || 'customer'
    };

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: safeUser
    });
  } catch (error) {
    console.error('PUT /api/user/profile error:', error);
    return NextResponse.json({ error: `Failed to update profile: ${error.message}` }, { status: 500 });
  }
}

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { normalizeAddress } from '@/lib/addresses.mjs';
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = snapshot.data();
    const addresses = Array.isArray(data.addresses) ? data.addresses : [];

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('GET /api/user/addresses error:', error);
    return NextResponse.json({ error: `Failed to load addresses: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authUser = verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userDocRef = doc(db, 'users', authUser.id);
    const snapshot = await getDoc(userDocRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = snapshot.data();
    const existingAddresses = Array.isArray(data.addresses) ? data.addresses : [];

    // Normalize and validate
    const isFirst = existingAddresses.length === 0;
    let newAddress;
    try {
      newAddress = normalizeAddress(body, isFirst);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    let updatedAddresses;
    if (newAddress.isDefault) {
      // Unset default on all other addresses
      updatedAddresses = [
        ...existingAddresses.map(a => ({ ...a, isDefault: false })),
        newAddress
      ];
    } else {
      updatedAddresses = [...existingAddresses, newAddress];
    }

    // Also update customer phone on profile if empty
    const updatePayload = {
      addresses: updatedAddresses,
      updatedAt: new Date().toISOString()
    };
    if (!data.phone && newAddress.phone) {
      updatePayload.phone = newAddress.phone;
    }

    await updateDoc(userDocRef, updatePayload);

    return NextResponse.json({
      message: 'Delivery address added successfully',
      address: newAddress,
      addresses: updatedAddresses
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/user/addresses error:', error);
    return NextResponse.json({ error: `Failed to add address: ${error.message}` }, { status: 500 });
  }
}

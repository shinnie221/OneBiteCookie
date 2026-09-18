import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { normalizeAddress, setDefaultAddress, removeAddress } from '@/lib/addresses.mjs';
import { NextResponse } from 'next/server';

export async function PUT(request, { params }) {
  try {
    const authUser = verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const userDocRef = doc(db, 'users', authUser.id);
    const snapshot = await getDoc(userDocRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = snapshot.data();
    const existingAddresses = Array.isArray(data.addresses) ? data.addresses : [];
    const index = existingAddresses.findIndex(a => a.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    let updatedAddress;
    try {
      updatedAddress = normalizeAddress({ ...body, id }, false);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    let updatedAddresses;
    if (updatedAddress.isDefault) {
      updatedAddresses = existingAddresses.map((a, i) =>
        i === index ? updatedAddress : { ...a, isDefault: false }
      );
    } else {
      // If was previous default and unsetting default, make sure at least one address is default
      const wasDefault = existingAddresses[index].isDefault;
      updatedAddresses = existingAddresses.map((a, i) => (i === index ? updatedAddress : a));
      if (wasDefault && !updatedAddresses.some(a => a.isDefault)) {
        updatedAddresses[0].isDefault = true;
      }
    }

    await updateDoc(userDocRef, {
      addresses: updatedAddresses,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      message: 'Address updated successfully',
      address: updatedAddress,
      addresses: updatedAddresses
    });
  } catch (error) {
    console.error('PUT /api/user/addresses/[id] error:', error);
    return NextResponse.json({ error: `Failed to update address: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const authUser = verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userDocRef = doc(db, 'users', authUser.id);
    const snapshot = await getDoc(userDocRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = snapshot.data();
    const existingAddresses = Array.isArray(data.addresses) ? data.addresses : [];
    const updatedAddresses = removeAddress(existingAddresses, id);

    await updateDoc(userDocRef, {
      addresses: updatedAddresses,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      message: 'Address deleted successfully',
      addresses: updatedAddresses
    });
  } catch (error) {
    console.error('DELETE /api/user/addresses/[id] error:', error);
    return NextResponse.json({ error: `Failed to delete address: ${error.message}` }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const authUser = verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userDocRef = doc(db, 'users', authUser.id);
    const snapshot = await getDoc(userDocRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = snapshot.data();
    const existingAddresses = Array.isArray(data.addresses) ? data.addresses : [];

    if (!existingAddresses.some(a => a.id === id)) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    const updatedAddresses = setDefaultAddress(existingAddresses, id);

    await updateDoc(userDocRef, {
      addresses: updatedAddresses,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      message: 'Default address updated successfully',
      addresses: updatedAddresses
    });
  } catch (error) {
    console.error('PATCH /api/user/addresses/[id] error:', error);
    return NextResponse.json({ error: `Failed to set default address: ${error.message}` }, { status: 500 });
  }
}

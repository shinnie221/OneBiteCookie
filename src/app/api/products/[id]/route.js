import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    
    const docRef = doc(db, 'products', id);
    const snapshot = await getDoc(docRef);
    
    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const existing = snapshot.data();

    const name = body.name ?? existing.name;
    const description = body.description ?? existing.description;
    const price = body.price !== undefined ? Number(body.price) : existing.price;
    const available = body.available !== undefined ? (body.available !== false && body.available !== 0) : existing.available;

    let images = existing.images || (existing.image ? [existing.image] : []);
    if (body.images !== undefined && Array.isArray(body.images)) {
      images = body.images;
    } else if (body.image !== undefined) {
      images = body.image ? [body.image] : [];
    }
    const image = images[0] || body.image || null;
    // Transparent-background photo used by the Build Your Own Box slots
    const cutout_image = body.cutout_image !== undefined ? (body.cutout_image || null) : (existing.cutout_image ?? null);

    const has_box_options = body.has_box_options !== undefined ? Boolean(body.has_box_options) : (existing.has_box_options !== false);
    const is_byob = body.is_byob !== undefined ? Boolean(body.is_byob) : Boolean(existing.is_byob);
    const box_4_price = body.box_4_price !== undefined ? (body.box_4_price !== null && body.box_4_price !== '' ? Number(body.box_4_price) : null) : (existing.box_4_price ?? null);
    const box_5_price = body.box_5_price !== undefined ? (body.box_5_price !== null && body.box_5_price !== '' ? Number(body.box_5_price) : null) : (existing.box_5_price ?? null);
    const box_6_price = body.box_6_price !== undefined ? (body.box_6_price !== null && body.box_6_price !== '' ? Number(body.box_6_price) : null) : (existing.box_6_price ?? null);
    const box_8_price = body.box_8_price !== undefined ? (body.box_8_price !== null && body.box_8_price !== '' ? Number(body.box_8_price) : null) : (existing.box_8_price ?? null);
    const box_12_price = body.box_12_price !== undefined ? (body.box_12_price !== null && body.box_12_price !== '' ? Number(body.box_12_price) : null) : (existing.box_12_price ?? null);

    const updatedData = { 
      name, 
      description, 
      price, 
      available, 
      image, 
      images,
      cutout_image,
      has_box_options,
      is_byob,
      box_4_price,
      box_5_price,
      box_6_price,
      box_8_price,
      box_12_price
    };
    
    await updateDoc(docRef, updatedData);

    return NextResponse.json({ 
      message: 'Product updated', 
      product: { id, ...updatedData } 
    });
  } catch (error) {
    console.error('PUT /api/products/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    await deleteDoc(doc(db, 'products', id));
    
    return NextResponse.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

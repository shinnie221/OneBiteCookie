import { db } from '@/lib/firebase';
import { ref, get, update, remove, child } from 'firebase/database';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `products/${id}`));
    
    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const existing = snapshot.val();

    const name = body.name ?? existing.name;
    const description = body.description ?? existing.description;
    const price = body.price ?? existing.price;
    const stock = body.stock ?? existing.stock;
    const available = body.available !== undefined ? !!body.available : existing.available;
    const image = body.image !== undefined ? body.image : existing.image;

    const updatedData = { name, description, price, stock, available, image };
    
    await update(ref(db, `products/${id}`), updatedData);

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
    
    await remove(ref(db, `products/${id}`));
    
    return NextResponse.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

import { rtdb as db } from '@/lib/firebase';
import { ref, get, push, set, child } from 'firebase/database';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'products'));
    
    let products = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      products = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
    }
    
    return NextResponse.json({ products });
  } catch (error) {
    console.error('GET /api/products error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { verifyAuth } = await import('@/lib/auth');
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, price, stock, available, image } = await request.json();
    
    if (!name || price == null) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }
    
    const newProduct = {
      name,
      description: description || '',
      price,
      stock: stock || 0,
      available: available ? true : false,
      image: image || null,
      createdAt: new Date().toISOString()
    };
    
    const productsRef = ref(db, 'products');
    const newProductRef = push(productsRef);
    await set(newProductRef, newProduct);

    return NextResponse.json({ 
      message: 'Product created',
      product: { id: newProductRef.key, ...newProduct }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

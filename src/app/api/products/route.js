import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    let products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    
    return NextResponse.json({ products }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
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

    const { 
      name, 
      description, 
      price, 
      available, 
      image, 
      images,
      has_box_options,
      is_byob,
      box_4_price,
      box_5_price,
      box_6_price,
      box_8_price,
      box_12_price
    } = await request.json();
    
    if (!name || price == null) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }
    
    const imageList = Array.isArray(images) && images.length > 0 
      ? images 
      : (image ? [image] : []);
    const primaryImage = imageList[0] || image || null;

    const newProduct = {
      name,
      description: description || '',
      price: Number(price),
      available: available !== false && available !== 0,
      image: primaryImage,
      images: imageList,
      has_box_options: has_box_options !== false,
      is_byob: Boolean(is_byob),
      box_4_price: box_4_price !== undefined && box_4_price !== null && box_4_price !== '' ? Number(box_4_price) : null,
      box_5_price: box_5_price !== undefined && box_5_price !== null && box_5_price !== '' ? Number(box_5_price) : null,
      box_6_price: box_6_price !== undefined && box_6_price !== null && box_6_price !== '' ? Number(box_6_price) : null,
      box_8_price: box_8_price !== undefined && box_8_price !== null && box_8_price !== '' ? Number(box_8_price) : null,
      box_12_price: box_12_price !== undefined && box_12_price !== null && box_12_price !== '' ? Number(box_12_price) : null,
      createdAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(db, 'products'), newProduct);

    return NextResponse.json({ 
      message: 'Product created',
      product: { id: docRef.id, ...newProduct }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

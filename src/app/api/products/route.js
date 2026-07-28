import { getDb, queryAll } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await seedDatabase();
    const db = await getDb();
    
    const products = queryAll(db, 'SELECT * FROM products WHERE available = 1 ORDER BY id ASC');
    
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

    const db = await getDb();
    const { name, description, price, stock, available, image } = await request.json();
    
    if (!name || price == null) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }
    
    const { runStmt } = await import('@/lib/db');
    const result = runStmt(db,
      'INSERT INTO products (name, description, price, stock, available, image) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', price, stock || 0, available ? 1 : 0, image || null]
    );

    return NextResponse.json({ 
      message: 'Product created',
      product: { id: result.lastInsertRowid, name, description, price, stock, available: available ? 1 : 0, image }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

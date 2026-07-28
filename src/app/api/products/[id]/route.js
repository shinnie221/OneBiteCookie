import { getDb, queryOne, runStmt } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const body = await request.json();
    
    const existing = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const name = body.name ?? existing.name;
    const description = body.description ?? existing.description;
    const price = body.price ?? existing.price;
    const stock = body.stock ?? existing.stock;
    const available = body.available !== undefined ? (body.available ? 1 : 0) : existing.available;
    const image = body.image !== undefined ? body.image : existing.image;

    runStmt(db,
      'UPDATE products SET name=?, description=?, price=?, stock=?, available=?, image=? WHERE id=?',
      [name, description, price, stock, available, image, id]
    );

    const updated = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
    return NextResponse.json({ message: 'Product updated', product: updated });
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
    const db = await getDb();
    
    runStmt(db, 'DELETE FROM products WHERE id = ?', [id]);
    
    return NextResponse.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { verifyAuth } = await import('@/lib/auth');
    const user = verifyAuth(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    let orderDoc = null;
    let orderId = id;
    
    // First try by document ID
    let docRef = doc(db, 'orders', id);
    let snapshot = await getDoc(docRef);
    
    if (snapshot.exists()) {
      orderDoc = snapshot.data();
    } else {
      // If not found by document ID, try by order_id field
      const q = query(collection(db, 'orders'), where('order_id', '==', id.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        orderId = docSnap.id;
        orderDoc = docSnap.data();
      }
    }
    
    if (!orderDoc) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = { id: orderId, ...orderDoc };

    if (user.role === 'customer' && order.customer_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('GET /api/orders/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { verifyAuth } = await import('@/lib/auth');
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    let orderDoc = null;
    let orderId = id;
    
    // First try by document ID
    let docRef = doc(db, 'orders', id);
    let snapshot = await getDoc(docRef);
    
    if (snapshot.exists()) {
      orderDoc = snapshot.data();
    } else {
      // If not found by document ID, try by order_id field
      const q = query(collection(db, 'orders'), where('order_id', '==', id.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        orderId = docSnap.id;
        orderDoc = docSnap.data();
        docRef = doc(db, 'orders', orderId);
      }
    }
    
    if (!orderDoc) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const existing = orderDoc;

    const updates = {};

    if (body.order_status !== undefined) {
      updates.order_status = body.order_status;
    }
    if (body.payment_status !== undefined) {
      updates.payment_status = body.payment_status;
    }
    if (body.reject_reason !== undefined) {
      updates.reject_reason = body.reject_reason;
    }
    if (body.staff_note !== undefined) {
      updates.staff_note = body.staff_note;
    }

    await updateDoc(docRef, updates);

    const updatedOrder = {
      id: orderId,
      ...existing,
      ...updates
    };

    return NextResponse.json({ message: 'Order updated', order: updatedOrder });
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

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

    const orderStatus = body.order_status ?? existing.order_status;
    const paymentStatus = body.payment_status ?? existing.payment_status;

    await updateDoc(docRef, {
      order_status: orderStatus,
      payment_status: paymentStatus
    });

    const updatedOrder = {
      id: orderId,
      ...existing,
      order_status: orderStatus,
      payment_status: paymentStatus
    };

    return NextResponse.json({ message: 'Order updated', order: updatedOrder });
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

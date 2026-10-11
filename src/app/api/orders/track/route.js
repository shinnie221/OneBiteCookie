import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get('orderId')?.trim();
    const phoneParam = searchParams.get('phone')?.trim();

    if (!orderIdParam && !phoneParam) {
      return NextResponse.json(
        { error: 'Please provide an Order ID or Phone Number to track.' },
        { status: 400 }
      );
    }

    const ordersRef = collection(db, 'orders');
    let matchedOrders = [];

    if (orderIdParam) {
      // 1. Try finding by order_id (e.g. OB-20261012-1234)
      const qId = query(ordersRef, where('order_id', '==', orderIdParam.toUpperCase()));
      const snapId = await getDocs(qId);
      
      snapId.forEach((docSnap) => {
        matchedOrders.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Also try exact match or lowercase
      if (matchedOrders.length === 0) {
        const qIdOrig = query(ordersRef, where('order_id', '==', orderIdParam));
        const snapIdOrig = await getDocs(qIdOrig);
        snapIdOrig.forEach((docSnap) => {
          matchedOrders.push({ id: docSnap.id, ...docSnap.data() });
        });
      }
    } else if (phoneParam) {
      // Clean phone number: remove dashes/spaces
      const cleanPhone = phoneParam.replace(/[\s-]/g, '');
      const qPhone = query(ordersRef, where('customer_phone', '==', phoneParam));
      const snapPhone = await getDocs(qPhone);
      snapPhone.forEach((docSnap) => {
        matchedOrders.push({ id: docSnap.id, ...docSnap.data() });
      });

      if (matchedOrders.length === 0) {
        // Fallback: search all orders in memory to match normalized phone
        const allSnap = await getDocs(ordersRef);
        allSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const p = (data.customer_phone || '').replace(/[\s-]/g, '');
          if (p && (p === cleanPhone || p.includes(cleanPhone) || cleanPhone.includes(p))) {
            matchedOrders.push({ id: docSnap.id, ...data });
          }
        });
      }
    }

    if (matchedOrders.length === 0) {
      return NextResponse.json(
        { error: 'No order found matching the provided details. Please check and try again.' },
        { status: 404 }
      );
    }

    // Sort newest first
    matchedOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Sanitize sensitive staff internal fields before returning to public
    const publicOrders = matchedOrders.map((o) => ({
      order_id: o.order_id,
      order_status: o.order_status,
      order_type: o.order_type,
      created_at: o.created_at,
      pickup_time: o.pickup_time || null,
      delivery_address: o.delivery_address || null,
      delivery_city: o.delivery_city || null,
      delivery_postcode: o.delivery_postcode || null,
      items: (o.items || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      total: o.total || 0,
      payment_method: o.payment_method || 'tng_qr',
    }));

    return NextResponse.json({ orders: publicOrders });
  } catch (error) {
    console.error('Error tracking order:', error);
    return NextResponse.json({ error: 'Failed to search order' }, { status: 500 });
  }
}

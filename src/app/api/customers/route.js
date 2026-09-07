import { db } from '@/lib/firebase';
import { collection, query as firestoreQuery, where, getDocs } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { verifyAuth } = await import('@/lib/auth');
    const user = verifyAuth(request);
    
    // Only allow admin or staff
    if (!user || user.role === 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch customers from Firestore
    const usersRef = collection(db, 'users');
    const q = firestoreQuery(usersRef, where('role', '==', 'customer'));
    const usersSnapshot = await getDocs(q);

    let customers = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      const { password, ...safeData } = data;
      customers.push({
        id: doc.id,
        ...safeData
      });
    });

    // Sort by created_at DESC
    customers.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
      const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
      return dateB - dateA;
    });

    // Fetch orders from Firestore
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    let orders = [];
    ordersSnapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    // Also get order counts and total spent for each customer
    for (let customer of customers) {
      const customerOrders = orders.filter(o => o.customer_id === customer.id);
      customer.orderCount = customerOrders.length;
      customer.totalSpent = customerOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    }

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('GET /api/customers error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

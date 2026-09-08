import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

function generateOrderId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `OB-${y}${m}${d}-${rand}`;
}

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const ordersRef = collection(db, 'orders');
    let snapshot;
    
    // Customer can only see their own orders
    if (user.role === 'customer') {
      const q = query(ordersRef, where('customer_id', '==', user.id));
      snapshot = await getDocs(q);
    } else {
      snapshot = await getDocs(ordersRef);
    }

    let orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    // Filter by status and date in memory since Firestore composite queries require indexes
    if (status && status !== 'all') {
      if (status === 'accepted') {
        const acceptedStatuses = ['accepted', 'preparing', 'ready_pickup', 'out_delivery'];
        orders = orders.filter(o => acceptedStatuses.includes(o.order_status));
      } else {
        orders = orders.filter(o => o.order_status === status);
      }
    }

    if (dateFrom) {
      orders = orders.filter(o => {
        const oDate = o.created_at ? o.created_at.split('T')[0] : '';
        return oDate >= dateFrom;
      });
    }
    if (dateTo) {
      orders = orders.filter(o => {
        const oDate = o.created_at ? o.created_at.split('T')[0] : '';
        return oDate <= dateTo;
      });
    }

    // Sort by descending created_at
    orders.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = verifyAuth(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isStaffOrAdmin = user.role === 'staff' || user.role === 'admin';
    const { 
      customer_name, 
      phone, 
      email, 
      order_type, 
      address, 
      items, 
      voucher_code, 
      payment_screenshot,
      payment_method,
      payment_status,
      order_status,
      staff_note,
      manual_discount,
      customer_id
    } = body;

    if (!customer_name || !phone || !items || items.length === 0) {
      return NextResponse.json({ error: 'Customer name, phone, and items are required' }, { status: 400 });
    }

    let subtotal = 0;
    const resolvedItems = [];
    
    for (const item of items) {
      const productRef = doc(db, 'products', item.product_id);
      const productSnapshot = await getDoc(productRef);
      
      if (!productSnapshot.exists()) {
        return NextResponse.json({ error: `Product "${item.product_name || 'Item'}" is no longer available` }, { status: 400 });
      }
      
      const product = productSnapshot.data();
      
      if (product.available === false || product.available === 0) {
        return NextResponse.json({ error: `Product "${product.name}" is marked as unavailable` }, { status: 400 });
      }
      
      if (product.stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for "${product.name}". Only ${product.stock} available.` }, { status: 400 });
      }
      
      const price = Number(item.price) || Number(product.price);
      const itemSubtotal = price * item.quantity;
      subtotal += itemSubtotal;
      
      resolvedItems.push({
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        price: price,
        subtotal: itemSubtotal
      });
    }

    let discount = 0;
    let matchedVoucherDocRef = null;
    let matchedVoucherData = null;

    if (manual_discount && isStaffOrAdmin) {
      discount = Math.min(Number(manual_discount) || 0, subtotal);
    } else if (voucher_code) {
      const today = new Date().toISOString().split('T')[0];
      const q = query(collection(db, 'vouchers'), where('code', '==', voucher_code.toUpperCase()));
      const voucherSnapshot = await getDocs(q);
      
      if (!voucherSnapshot.empty) {
        const vDoc = voucherSnapshot.docs[0];
        const voucher = vDoc.data();
        const active = voucher.active === 1 || voucher.active === true;
        const notExpired = !voucher.expiry_date || voucher.expiry_date >= today;
        const usageLimit = voucher.usage_limit || 'unlimited';

        // Check exclusive customer targeting
        if (voucher.customer_email && !isStaffOrAdmin) {
          const userEmail = (user.email || email || '').toLowerCase();
          if (userEmail !== voucher.customer_email.toLowerCase()) {
            return NextResponse.json({ error: 'This voucher is exclusively reserved for another customer account' }, { status: 400 });
          }
        }

        // Check single-use total
        if (usageLimit === 'once_total' && (voucher.times_used || 0) >= 1) {
          return NextResponse.json({ error: 'This single-use voucher has already been redeemed' }, { status: 400 });
        }

        // Check once per customer
        if (usageLimit === 'once_per_customer' && !isStaffOrAdmin) {
          const usedBy = Array.isArray(voucher.used_by) ? voucher.used_by : [];
          if (usedBy.includes(user.id) || (user.email && usedBy.includes(user.email))) {
            return NextResponse.json({ error: 'You have already used this voucher before' }, { status: 400 });
          }
        }
        
        if (active && notExpired && subtotal >= voucher.min_order) {
          if (voucher.discount_type === 'percentage') {
            discount = subtotal * (voucher.discount_value / 100);
          } else {
            discount = voucher.discount_value;
          }
          discount = Math.min(discount, subtotal);
          matchedVoucherDocRef = vDoc.ref;
          matchedVoucherData = voucher;
        }
      }
    }

    const total = Math.max(0, subtotal - discount);
    const orderId = generateOrderId();
    const createdAt = new Date().toISOString();

    // Determine customer_id
    let finalCustomerId = isStaffOrAdmin ? 'manual_entry' : user.id;
    if (isStaffOrAdmin) {
      if (customer_id) {
        finalCustomerId = customer_id;
      } else if (email) {
        try {
          const userQ = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
          const userSnap = await getDocs(userQ);
          if (!userSnap.empty) {
            finalCustomerId = userSnap.docs[0].id;
          }
        } catch (e) {
          console.error('Customer lookup error:', e);
        }
      }
    }

    // Determine initial payment and order status
    let finalPaymentStatus = 'pending';
    let finalOrderStatus = 'pending_verification';

    if (isStaffOrAdmin) {
      finalPaymentStatus = payment_status || 'verified';
      finalOrderStatus = order_status || 'preparing';
    }

    const newOrder = {
      order_id: orderId,
      customer_id: finalCustomerId,
      customer_name,
      phone,
      email: email || '',
      order_type: order_type || 'pickup',
      address: address || '',
      subtotal,
      discount,
      total,
      voucher_code: voucher_code || (manual_discount ? 'Manual Discount' : null),
      payment_screenshot: payment_screenshot || null,
      payment_method: payment_method || (isStaffOrAdmin ? 'cash' : (payment_screenshot ? 'qr_transfer' : 'manual')),
      payment_status: finalPaymentStatus,
      order_status: finalOrderStatus,
      staff_note: staff_note || (isStaffOrAdmin ? `Manually keyed in by ${user.name || user.email || 'staff'}` : null),
      is_manual_order: isStaffOrAdmin ? true : false,
      items: resolvedItems,
      created_at: createdAt
    };

    const docRef = await addDoc(collection(db, 'orders'), newOrder);

    // Update voucher usage if applied
    if (matchedVoucherDocRef && matchedVoucherData) {
      try {
        const currentTimesUsed = (matchedVoucherData.times_used || 0) + 1;
        const currentUsedBy = Array.isArray(matchedVoucherData.used_by) ? [...matchedVoucherData.used_by] : [];
        if (user.id && !currentUsedBy.includes(user.id)) {
          currentUsedBy.push(user.id);
        }
        if (user.email && !currentUsedBy.includes(user.email)) {
          currentUsedBy.push(user.email);
        }

        const vUpdates = {
          times_used: currentTimesUsed,
          used_by: currentUsedBy
        };

        // If single use total, deactivate it once used
        if (matchedVoucherData.usage_limit === 'once_total') {
          vUpdates.active = 0;
        }

        await updateDoc(matchedVoucherDocRef, vUpdates);
      } catch (err) {
        console.error('Error updating voucher usage:', err);
      }
    }

    // Deduct stock
    for (const item of resolvedItems) {
      const productRef = doc(db, 'products', item.product_id);
      const snap = await getDoc(productRef);
      if (snap.exists()) {
        const prod = snap.data();
        await updateDoc(productRef, { stock: Math.max(0, prod.stock - item.quantity) });
      }
    }

    return NextResponse.json({
      message: 'Order created successfully',
      order: { id: docRef.id, ...newOrder }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}

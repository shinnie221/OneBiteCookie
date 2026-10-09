import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
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
      if (body.order_status === 'completed') {
        updates.completed_at = body.completed_at || existing.completed_at || new Date().toISOString();
      } else if (existing.completed_at) {
        updates.completed_at = null;
      }
    }
    if (body.completed_at !== undefined) {
      updates.completed_at = body.completed_at;
    }
    updates.updated_at = new Date().toISOString();
    if (body.payment_status !== undefined) {
      updates.payment_status = body.payment_status;
    }
    if (body.reject_reason !== undefined) {
      updates.reject_reason = body.reject_reason;
    }
    if (body.staff_note !== undefined) {
      updates.staff_note = body.staff_note;
    }
    // Editable fields
    if (body.customer_name !== undefined) {
      updates.customer_name = body.customer_name;
    }
    if (body.phone !== undefined) {
      updates.phone = body.phone;
    }
    if (body.email !== undefined) {
      updates.email = body.email;
    }
    if (body.order_type !== undefined) {
      updates.order_type = body.order_type;
    }
    if (body.address !== undefined) {
      updates.address = body.address;
    }
    if (body.delivery_method !== undefined) {
      updates.delivery_method = body.delivery_method;
    }
    if (body.lalamove_cost !== undefined) {
      updates.lalamove_cost = body.lalamove_cost !== '' ? Math.round((Number(body.lalamove_cost) || 0) * 100) / 100 : 0;
    }
    if (body.lalamove_payer !== undefined) {
      updates.lalamove_payer = body.lalamove_payer;
    }
    if (body.lalamove_receipt_url !== undefined) {
      updates.lalamove_receipt_url = body.lalamove_receipt_url;
    }
    // Items and pricing updates
    if (body.items !== undefined && Array.isArray(body.items)) {
      updates.items = body.items;
    }
    if (body.subtotal !== undefined) {
      updates.subtotal = Number(body.subtotal) || 0;
    }
    if (body.discount !== undefined) {
      updates.discount = Number(body.discount) || 0;
    }
    if (body.delivery_fee !== undefined) {
      updates.delivery_fee = Number(body.delivery_fee) || 0;
    }
    if (body.total !== undefined) {
      updates.total = Number(body.total) || 0;
    }

    const effectiveOrderType = updates.order_type !== undefined ? updates.order_type : existing.order_type;
    const effectiveDeliveryMethod = updates.delivery_method !== undefined ? updates.delivery_method : existing.delivery_method;

    if (effectiveDeliveryMethod === 'lalamove') {
      const finalCost = updates.lalamove_cost !== undefined ? updates.lalamove_cost : (Number(existing.lalamove_cost) || 0);
      updates.lalamove_extra_amount = Math.max(0, Math.round((finalCost - 8) * 100) / 100);
    }

    await updateDoc(docRef, updates);

    // Sync financial records for Lalamove delivery
    try {
      const isLalamove = effectiveOrderType === 'delivery' && effectiveDeliveryMethod === 'lalamove';
      const orderIdStr = existing.order_id || orderId;

      const financeRef = collection(db, 'finance_records');
      const qFinance = query(financeRef, where('linked_order_id', '==', orderIdStr));
      const financeSnap = await getDocs(qFinance);
      
      const autoRecords = [];
      financeSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.auto_generated) {
          autoRecords.push({ id: docSnap.id, ...data });
        }
      });

      if (isLalamove) {
        const cost = updates.lalamove_cost !== undefined ? updates.lalamove_cost : (Number(existing.lalamove_cost) || 0);
        const payer = updates.lalamove_payer !== undefined ? updates.lalamove_payer : (existing.lalamove_payer || 'Shinnie');
        const payerLabel = (payer === 'Yunxuan' || payer.includes('Yunxuan')) ? 'Yunxuan个人先行垫付' : 'Shinnie个人先行垫付';
        const receiptUrl = updates.lalamove_receipt_url !== undefined ? updates.lalamove_receipt_url : (existing.lalamove_receipt_url || '');
        const extraAmount = Math.max(0, Math.round((cost - 8) * 100) / 100);
        const recordDate = (existing.created_at || new Date().toISOString()).split('T')[0];

        // 1. Income Record (RM 8 Customer Delivery Fee)
        const existingIncome = autoRecords.find(r => r.record_sub_type === 'delivery_customer_fee' || r.transactionType === '收入');
        const incomeData = {
          date: recordDate,
          transactionType: '收入',
          category: '配送相关',
          amount: 8,
          orderType: 'Pre-order',
          note: `顾客固定配送费RM8 (订单#${orderIdStr})`,
          linked_order_id: orderIdStr,
          auto_generated: true,
          record_sub_type: 'delivery_customer_fee',
          receiptUrl: '',
          supplierName: '',
          updated_at: new Date().toISOString()
        };

        if (existingIncome) {
          await updateDoc(doc(db, 'finance_records', existingIncome.id), incomeData);
        } else {
          await addDoc(financeRef, {
            ...incomeData,
            created_by: user.name || user.email || 'system',
            created_at: new Date().toISOString()
          });
        }

        // 2. Expense Record (Full Lalamove Delivery Fee)
        const existingExpense = autoRecords.find(r => r.record_sub_type === 'delivery_lalamove_cost' || r.transactionType === '支出');
        const expenseData = {
          date: recordDate,
          transactionType: '支出',
          category: '配送相关',
          amount: cost,
          orderType: 'Pre-order',
          note: `Lalamove运费 RM${cost.toFixed(2)} (多出差额RM${extraAmount.toFixed(2)}由公款承担) · 垫付人: ${payerLabel} (先垫付后从公款报销) (订单#${orderIdStr})`,
          receiptUrl: receiptUrl.trim(),
          supplierName: 'Lalamove',
          payer: payer,
          extra_amount: extraAmount,
          linked_order_id: orderIdStr,
          auto_generated: true,
          record_sub_type: 'delivery_lalamove_cost',
          updated_at: new Date().toISOString()
        };

        if (existingExpense) {
          await updateDoc(doc(db, 'finance_records', existingExpense.id), expenseData);
        } else {
          await addDoc(financeRef, {
            ...expenseData,
            created_by: user.name || user.email || 'system',
            created_at: new Date().toISOString()
          });
        }
      } else {
        // If not Lalamove (e.g. admin_delivery or pickup), delete any existing auto records for this order
        for (const rec of autoRecords) {
          try {
            await deleteDoc(doc(db, 'finance_records', rec.id));
          } catch (e) {
            console.error('Error deleting obsolete auto finance record:', e);
          }
        }
      }
    } catch (financeErr) {
      console.error('Error syncing delivery finance records:', financeErr);
    }

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

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Optional auth check for customer
    let currentUser = null;
    try {
      currentUser = verifyAuth(request);
    } catch (e) {
      // Unauthenticated is fine
    }

    // Check actual active orders placed by currentUser to verify used vouchers
    const userUsedVoucherCodes = new Set();
    if (currentUser) {
      try {
        if (currentUser.id) {
          const orderQ = query(
            collection(db, 'orders'),
            where('customer_id', '==', currentUser.id)
          );
          const orderSnap = await getDocs(orderQ);
          orderSnap.forEach(d => {
            const od = d.data();
            if (od.voucher_code && od.order_status !== 'cancelled' && od.order_status !== 'rejected') {
              userUsedVoucherCodes.add(od.voucher_code.trim().toUpperCase());
            }
          });
        }

        if (currentUser.email) {
          const orderQEmail = query(
            collection(db, 'orders'),
            where('email', '==', currentUser.email.toLowerCase())
          );
          const orderSnapEmail = await getDocs(orderQEmail);
          orderSnapEmail.forEach(d => {
            const od = d.data();
            if (od.voucher_code && od.order_status !== 'cancelled' && od.order_status !== 'rejected') {
              userUsedVoucherCodes.add(od.voucher_code.trim().toUpperCase());
            }
          });
        }
      } catch (e) {
        console.warn('Error checking user order history for vouchers:', e);
      }
    }

    const vouchersRef = collection(db, 'vouchers');
    const snapshot = await getDocs(vouchersRef);
    
    const availableVouchers = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const isActive = data.active === 1 || data.active === true;
      const isPublic = data.is_public !== false; // Default true if not specified
      const notExpired = !data.expiry_date || data.expiry_date >= today;
      
      // Check single-use total
      const isOnceTotal = data.usage_limit === 'once_total';
      const isUsedUp = isOnceTotal && (data.times_used || 0) >= 1;

      // Check once per customer
      const isOncePerCustomer = data.usage_limit === 'once_per_customer';
      let alreadyUsedByThisUser = false;
      if (isOncePerCustomer && currentUser) {
        const upperCode = (data.code || '').trim().toUpperCase();
        if (userUsedVoucherCodes.has(upperCode)) {
          alreadyUsedByThisUser = true;
        } else if (Array.isArray(data.used_by)) {
          const inUsedBy = data.used_by.includes(currentUser.id) || (currentUser.email && data.used_by.includes(currentUser.email));
          if (inUsedBy) {
            // Reconcile stale used_by entry because no active orders exist in Firestore
            const cleaned = data.used_by.filter(id => id !== currentUser.id && id !== currentUser.email);
            updateDoc(doc.ref, {
              used_by: cleaned,
              times_used: Math.max(0, (data.times_used || 1) - 1)
            }).catch(() => {});
          }
        }
      }

      // Check customer targeting (if assigned to a specific customer)
      const isTargeted = data.target_type === 'specific_customer' || Boolean(data.customer_email);
      if (isTargeted) {
        // Only visible if the logged-in customer matches the targeted customer email
        if (!currentUser || !currentUser.email) {
          return; // Skip for guests / unauthenticated
        }
        if (currentUser.email.toLowerCase() !== (data.customer_email || '').toLowerCase()) {
          return; // Skip for other customers
        }
      }

      if (isActive && isPublic && notExpired && !isUsedUp && !alreadyUsedByThisUser) {
        availableVouchers.push({
          id: doc.id,
          code: data.code,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          min_order: data.min_order || 0,
          expiry_date: data.expiry_date || null,
          usage_limit: data.usage_limit || 'unlimited',
          is_public: true,
          is_targeted: isTargeted,
          customer_name: data.customer_name || null
        });
      }
    });

    return NextResponse.json({ vouchers: availableVouchers });
  } catch (error) {
    console.error('GET /api/vouchers/public error:', error);
    return NextResponse.json({ error: 'Failed to fetch public vouchers' }, { status: 500 });
  }
}

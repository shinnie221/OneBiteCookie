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
    const currentMonth = today.slice(0, 7);
    const userUsedVoucherCodes = new Set();
    const userMonthUsedCounts = {}; // { UPPER_CODE: count }
    const totalMonthUsedCounts = {}; // { UPPER_CODE: count }

    // First load all current month orders with vouchers to check total and user monthly limits
    try {
      const allOrdersSnap = await getDocs(collection(db, 'orders'));
      allOrdersSnap.forEach(d => {
        const od = d.data();
        if (od.voucher_code && od.order_status !== 'cancelled' && od.order_status !== 'rejected') {
          const codeUpper = od.voucher_code.trim().toUpperCase();
          const orderDate = od.created_at || '';
          const isMonth = orderDate.startsWith(currentMonth);

          if (isMonth) {
            totalMonthUsedCounts[codeUpper] = (totalMonthUsedCounts[codeUpper] || 0) + 1;
          }

          if (currentUser) {
            const isUserMatch = (currentUser.id && od.customer_id === currentUser.id) ||
              (currentUser.email && od.email && od.email.toLowerCase() === currentUser.email.toLowerCase());
            if (isUserMatch) {
              userUsedVoucherCodes.add(codeUpper);
              if (isMonth) {
                userMonthUsedCounts[codeUpper] = (userMonthUsedCounts[codeUpper] || 0) + 1;
              }
            }
          }
        }
      });
    } catch (e) {
      console.warn('Error checking orders for vouchers:', e);
    }

    const vouchersRef = collection(db, 'vouchers');
    const snapshot = await getDocs(vouchersRef);
    
    const availableVouchers = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const isActive = data.active === 1 || data.active === true;
      const isPublic = data.is_public !== false; // Default true if not specified
      const notExpired = !data.expiry_date || data.expiry_date >= today;
      const upperCode = (data.code || '').trim().toUpperCase();
      
      // Check single-use total
      const isOnceTotal = data.usage_limit === 'once_total';
      const isUsedUp = isOnceTotal && (data.times_used || 0) >= 1;

      // Check once per customer
      const isOncePerCustomer = data.usage_limit === 'once_per_customer';
      let alreadyUsedByThisUser = false;
      if (isOncePerCustomer && currentUser) {
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

      // Check monthly per customer
      let monthlyPerCustomerExhausted = false;
      if (data.usage_limit === 'monthly_per_customer' && currentUser) {
        const userCount = userMonthUsedCounts[upperCode] || 0;
        const limit = Math.max(1, Number(data.monthly_limit) || 1);
        if (userCount >= limit) {
          monthlyPerCustomerExhausted = true;
        }
      }

      // Check monthly total shop-wide
      let monthlyTotalExhausted = false;
      if (data.usage_limit === 'monthly_total') {
        const totalCount = totalMonthUsedCounts[upperCode] || 0;
        const limit = Math.max(1, Number(data.monthly_limit) || 1);
        if (totalCount >= limit) {
          monthlyTotalExhausted = true;
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

      if (isActive && isPublic && notExpired && !isUsedUp && !alreadyUsedByThisUser && !monthlyPerCustomerExhausted && !monthlyTotalExhausted) {
        availableVouchers.push({
          id: doc.id,
          code: data.code,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          min_order: data.min_order || 0,
          expiry_date: data.expiry_date || null,
          usage_limit: data.usage_limit || 'unlimited',
          monthly_limit: data.monthly_limit || 1,
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

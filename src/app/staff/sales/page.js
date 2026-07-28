'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

export default function SalesPage() {
  const { authFetch } = useAuth();
  const toast = useToast();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [dateFilter, setDateFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    fetchSales();
  }, [dateFilter]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      let url = '/api/orders?status=all';
      
      const today = new Date();
      let fromDate = '';
      let toDate = '';
      
      if (dateFilter === 'today') {
        fromDate = today.toISOString().split('T')[0];
        toDate = fromDate;
      } else if (dateFilter === 'week') {
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        fromDate = lastWeek.toISOString().split('T')[0];
        toDate = today.toISOString().split('T')[0];
      } else if (dateFilter === 'month') {
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        fromDate = lastMonth.toISOString().split('T')[0];
        toDate = today.toISOString().split('T')[0];
      } else if (dateFilter === 'custom') {
        if (!customFrom || !customTo) {
          setLoading(false);
          return; // Wait for user to click apply
        }
        fromDate = customFrom;
        toDate = customTo;
      }
      
      if (fromDate) url += `&dateFrom=${fromDate}`;
      if (toDate) url += `&dateTo=${toDate}`;
      
      const res = await authFetch(url);
      const data = await res.json();
      if (res.ok) {
        // Filter out rejected and cancelled orders for actual sales data
        const validSales = data.orders.filter(o => 
          o.order_status !== 'rejected' && o.order_status !== 'cancelled'
        );
        setOrders(validSales);
      }
    } catch (error) {
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomDateSubmit = (e) => {
    e.preventDefault();
    if (customFrom && customTo) {
      fetchSales();
    } else {
      toast.error('Please select both start and end dates');
    }
  };

  // Calculate totals
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalOrders = orders.length;
  
  let itemsSold = 0;
  orders.forEach(order => {
    order.items.forEach(item => {
      itemsSold += item.quantity;
    });
  });

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Sales History</h1>
      </div>

      <div className="card mb3">
        <div className={styles.filtersSection}>
          <div className={styles.filterTabs}>
            <button 
              className={`${styles.filterTab} ${dateFilter === 'today' ? styles.active : ''}`}
              onClick={() => setDateFilter('today')}
            >
              Today
            </button>
            <button 
              className={`${styles.filterTab} ${dateFilter === 'week' ? styles.active : ''}`}
              onClick={() => setDateFilter('week')}
            >
              Last 7 Days
            </button>
            <button 
              className={`${styles.filterTab} ${dateFilter === 'month' ? styles.active : ''}`}
              onClick={() => setDateFilter('month')}
            >
              Last 30 Days
            </button>
            <button 
              className={`${styles.filterTab} ${dateFilter === 'custom' ? styles.active : ''}`}
              onClick={() => setDateFilter('custom')}
            >
              Custom Range
            </button>
          </div>

          {dateFilter === 'custom' && (
            <form onSubmit={handleCustomDateSubmit} className={styles.customDateForm}>
              <div className={styles.dateInput}>
                <label>From</label>
                <input 
                  type="date" 
                  value={customFrom} 
                  onChange={(e) => setCustomFrom(e.target.value)} 
                  required
                />
              </div>
              <div className={styles.dateInput}>
                <label>To</label>
                <input 
                  type="date" 
                  value={customTo} 
                  onChange={(e) => setCustomTo(e.target.value)} 
                  required
                />
              </div>
              <button type="submit" className="btn btnPrimary">Apply</button>
            </form>
          )}
        </div>

        <div className={styles.summaryStats}>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Total Revenue</div>
            <div className={styles.statValuePrimary}>RM{totalRevenue.toFixed(2)}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Orders Completed</div>
            <div className={styles.statValue}>{totalOrders}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Cookies Sold</div>
            <div className={styles.statValue}>{itemsSold}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Average Order Value</div>
            <div className={styles.statValue}>
              RM{totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0.00'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className={styles.cardHeader}>
          <h2>Transaction Log</h2>
          <button onClick={fetchSales} className="btn btnSecondary" style={{ padding: '6px 12px' }}>↻ Refresh</button>
        </div>
        
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Discount</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="textCenter">No sales data for this period</td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id}>
                      <td>{new Date(order.created_at).toLocaleString()}</td>
                      <td className={styles.orderId}>{order.order_id}</td>
                      <td>{order.customer_name}</td>
                      <td>
                        <div className={styles.itemsSummary}>
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                        </div>
                      </td>
                      <td className={order.discount > 0 ? styles.textSuccess : ''}>
                        {order.discount > 0 ? `-RM${order.discount.toFixed(2)}` : '-'}
                      </td>
                      <td className={styles.totalCell}>RM{order.total.toFixed(2)}</td>
                      <td><OrderStatusBadge status={order.order_status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

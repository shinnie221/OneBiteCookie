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
  
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'monthly' | 'yearly' | 'custom'
  
  // Daily: specific date
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Monthly: year and month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // Yearly: year
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  // Custom range
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    fetchSales();
  }, [viewMode, selectedDate, selectedMonth, selectedYear]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      let url = '/api/orders?status=all';
      
      let fromDate = '';
      let toDate = '';
      
      if (viewMode === 'daily') {
        fromDate = selectedDate;
        toDate = selectedDate;
      } else if (viewMode === 'monthly') {
        const [year, month] = selectedMonth.split('-');
        fromDate = `${year}-${month}-01`;
        // Last day of the month
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        toDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      } else if (viewMode === 'yearly') {
        fromDate = `${selectedYear}-01-01`;
        toDate = `${selectedYear}-12-31`;
      } else if (viewMode === 'custom') {
        if (!customFrom || !customTo) {
          setLoading(false);
          return;
        }
        fromDate = customFrom;
        toDate = customTo;
      }
      
      if (fromDate) url += `&dateFrom=${fromDate}`;
      if (toDate) url += `&dateTo=${toDate}`;
      
      const res = await authFetch(url);
      const data = await res.json();
      if (res.ok) {
        // Filter out rejected, cancelled, and refunded orders for actual sales data
        const validSales = data.orders.filter(o => 
          o.order_status !== 'rejected' && o.order_status !== 'cancelled' && o.order_status !== 'refunded'
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

  // Navigate daily date
  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const today = new Date().toISOString().split('T')[0];
    const nextDate = d.toISOString().split('T')[0];
    if (nextDate <= today) {
      setSelectedDate(nextDate);
    }
  };

  // Navigate monthly
  const goToPrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const goToNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    const now = new Date();
    if (d <= now) {
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  };

  // Navigate yearly
  const goToPrevYear = () => {
    setSelectedYear(String(parseInt(selectedYear) - 1));
  };

  const goToNextYear = () => {
    if (parseInt(selectedYear) < new Date().getFullYear()) {
      setSelectedYear(String(parseInt(selectedYear) + 1));
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

  // Export CSV
  const exportCSV = () => {
    if (orders.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Date & Time', 'Order ID', 'Customer', 'Items', 'Discount', 'Total', 'Status'];
    
    const rows = orders.map(order => {
      const itemsText = order.items.map(i => `${i.quantity}x ${i.product_name}`).join('; ');
      return [
        new Date(order.created_at).toLocaleString(),
        order.order_id,
        `"${order.customer_name}"`,
        `"${itemsText}"`,
        order.discount > 0 ? `-RM${order.discount.toFixed(2)}` : '-',
        `RM${order.total.toFixed(2)}`,
        order.order_status
      ];
    });

    // Add summary row
    rows.push([]);
    rows.push(['SUMMARY']);
    rows.push(['Total Revenue', '', '', '', '', `RM${totalRevenue.toFixed(2)}`]);
    rows.push(['Total Orders', '', '', '', '', totalOrders]);
    rows.push(['Items Sold', '', '', '', '', itemsSold]);
    rows.push(['Average Order Value', '', '', '', '', `RM${totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0.00'}`]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Generate filename based on current filter
    let filename = 'sales_report';
    if (viewMode === 'daily') filename += `_${selectedDate}`;
    else if (viewMode === 'monthly') filename += `_${selectedMonth}`;
    else if (viewMode === 'yearly') filename += `_${selectedYear}`;
    else if (viewMode === 'custom') filename += `_${customFrom}_to_${customTo}`;
    filename += '.csv';
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Sales report exported!');
  };

  // Format the current view label
  const getViewLabel = () => {
    if (viewMode === 'daily') {
      const d = new Date(selectedDate + 'T00:00:00');
      return d.toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (viewMode === 'monthly') {
      const [y, m] = selectedMonth.split('-');
      return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'yearly') return selectedYear;
    return 'Custom Range';
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Sales Report</h1>
        <button onClick={exportCSV} className={styles.exportBtn} disabled={orders.length === 0}>
          📊 Export CSV
        </button>
      </div>

      <div className="card mb3">
        <div className={styles.filtersSection}>
          <div className={styles.filterTabs}>
            <button 
              className={`${styles.filterTab} ${viewMode === 'daily' ? styles.active : ''}`}
              onClick={() => setViewMode('daily')}
            >
              Daily
            </button>
            <button 
              className={`${styles.filterTab} ${viewMode === 'monthly' ? styles.active : ''}`}
              onClick={() => setViewMode('monthly')}
            >
              Monthly
            </button>
            <button 
              className={`${styles.filterTab} ${viewMode === 'yearly' ? styles.active : ''}`}
              onClick={() => setViewMode('yearly')}
            >
              Yearly
            </button>
            <button 
              className={`${styles.filterTab} ${viewMode === 'custom' ? styles.active : ''}`}
              onClick={() => setViewMode('custom')}
            >
              Custom Range
            </button>
          </div>

          {/* Date Navigation */}
          {viewMode === 'daily' && (
            <div className={styles.dateNavigator}>
              <button className={styles.navBtn} onClick={goToPrevDay}>◀</button>
              <div className={styles.navDatePicker}>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <button className={styles.navBtn} onClick={goToNextDay} disabled={selectedDate >= new Date().toISOString().split('T')[0]}>▶</button>
            </div>
          )}

          {viewMode === 'monthly' && (
            <div className={styles.dateNavigator}>
              <button className={styles.navBtn} onClick={goToPrevMonth}>◀</button>
              <div className={styles.navDatePicker}>
                <input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <button className={styles.navBtn} onClick={goToNextMonth}>▶</button>
            </div>
          )}

          {viewMode === 'yearly' && (
            <div className={styles.dateNavigator}>
              <button className={styles.navBtn} onClick={goToPrevYear}>◀</button>
              <div className={styles.navDatePicker}>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button className={styles.navBtn} onClick={goToNextYear} disabled={parseInt(selectedYear) >= new Date().getFullYear()}>▶</button>
            </div>
          )}

          {viewMode === 'custom' && (
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

          {/* Current View Label */}
          <div className={styles.viewLabel}>
            {getViewLabel()}
          </div>
        </div>

        <div className={styles.summaryStats}>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Total Revenue</div>
            <div className={styles.statValuePrimary}>RM{totalRevenue.toFixed(2)}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Orders</div>
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

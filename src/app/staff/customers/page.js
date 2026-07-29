'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

export default function CustomersPage() {
  const { authFetch } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await authFetch('/api/customers');
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to load customers');
      
      setCustomers(data.customers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Registered Customers</h1>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          Total Customers: {customers.length}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div className="card">
        <div className="tableResponsive">
          <table className="table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Registered Date</th>
                <th>Total Orders</th>
                <th>Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map(customer => (
                  <tr key={customer.id}>
                    <td>#{customer.id}</td>
                    <td style={{ fontWeight: '500' }}>{customer.name}</td>
                    <td>{customer.email}</td>
                    <td>{new Date(customer.created_at).toLocaleDateString()}</td>
                    <td>
                      <span style={{ 
                        background: '#e0f2fe', 
                        color: '#0369a1',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        {customer.orderCount}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600', color: '#047857' }}>
                      RM{customer.totalSpent ? customer.totalSpent.toFixed(2) : '0.00'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

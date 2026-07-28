'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [staff, setStaff] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('onebite_token');
      const savedStaff = localStorage.getItem('onebite_staff');
      if (savedToken && savedStaff) {
        setToken(savedToken);
        setStaff(JSON.parse(savedStaff));
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    setToken(data.token);
    setStaff(data.staff);
    localStorage.setItem('onebite_token', data.token);
    localStorage.setItem('onebite_staff', JSON.stringify(data.staff));
    
    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setStaff(null);
    localStorage.removeItem('onebite_token');
    localStorage.removeItem('onebite_staff');
  }, []);

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = {
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  }, [token]);

  const isAuthenticated = !!token && !!staff;

  return (
    <AuthContext.Provider value={{ staff, token, loading, isAuthenticated, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

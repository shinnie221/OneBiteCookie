'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const [sessionExpired, setSessionExpired] = useState(false);

  // Helper to test if a JWT string is expired
  const isTokenExpired = useCallback((jwtToken) => {
    if (!jwtToken || typeof jwtToken !== 'string') return true;
    try {
      const parts = jwtToken.split('.');
      if (parts.length < 2) return true;
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('onebite_token');
      const savedUser = localStorage.getItem('onebite_user');
      if (savedToken && savedUser) {
        if (isTokenExpired(savedToken)) {
          console.warn('OneBite: Stored session token is expired. Clearing stale session.');
          localStorage.removeItem('onebite_token');
          localStorage.removeItem('onebite_user');
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSessionExpired(true);
        } else {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      }
    } catch (e) {}
    setLoading(false);
  }, [isTokenExpired]);

  const loginWithGoogle = useCallback(async () => {
    setSessionExpired(false);
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;

    // Call our API to create/find user in Firestore and get JWT
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Google login failed');
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('onebite_token', data.token);
    localStorage.setItem('onebite_user', JSON.stringify(data.user));

    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setSessionExpired(false);
    localStorage.removeItem('onebite_token');
    localStorage.removeItem('onebite_user');
    auth.signOut().catch(() => {});
  }, []);

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = {
      ...options.headers,
    };
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('onebite_token') : null);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }
    const res = await fetch(url, { ...options, headers });
    // If API rejects token as unauthorized/expired
    if (res.status === 401) {
      console.warn('API returned 401 Unauthorized. Session expired.');
      setToken(null);
      setUser(null);
      localStorage.removeItem('onebite_token');
      localStorage.removeItem('onebite_user');
      setSessionExpired(true);
    }
    return res;
  }, [token]);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, sessionExpired, setSessionExpired, loginWithGoogle, logout, authFetch }}>
      {children}
      {sessionExpired && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 99999,
          background: '#1e293b',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          border: '1px solid #334155',
          maxWidth: '420px',
          animation: 'slideUp 0.3s ease'
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 2 }}>⚠️ 登录凭证已过期</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>长时间未操作或登录已失效，请重新登录以正常使用所有功能。</div>
          </div>
          <button
            type="button"
            className="btn btnPrimary"
            style={{ fontSize: '0.82rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
            onClick={() => {
              loginWithGoogle().catch(err => {
                console.error('Re-login failed:', err);
              });
            }}
          >
            重新登录
          </button>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

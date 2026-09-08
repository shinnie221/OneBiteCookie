'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('onebite_token');
      const savedUser = localStorage.getItem('onebite_user');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    // Try Firebase Auth first, fall back to legacy Firestore-based login
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (firebaseError) {
      // Silently continue — user may be a legacy account not in Firebase Auth
    }

    // Always call our API to get a JWT (works for both Firebase Auth and legacy users)
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
    setUser(data.user);
    localStorage.setItem('onebite_token', data.token);
    localStorage.setItem('onebite_user', JSON.stringify(data.user));
    
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    // Create user in Firebase Auth first (for password reset support)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
    } catch (firebaseError) {
      // If Firebase Auth creation fails (e.g., email exists), continue with legacy registration
      // The API will handle the duplicate check
      if (firebaseError.code !== 'auth/email-already-in-use') {
        console.warn('Firebase Auth registration warning:', firebaseError.message);
      }
    }

    // Register in our system to get JWT
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('onebite_token', data.token);
    localStorage.setItem('onebite_user', JSON.stringify(data.user));
    
    return data;
  }, []);

  const loginWithGoogle = useCallback(async () => {
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

  const forgotPassword = useCallback(async (email) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('onebite_token');
    localStorage.removeItem('onebite_user');
    // Also sign out of Firebase Auth
    auth.signOut().catch(() => {});
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

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, login, register, loginWithGoogle, forgotPassword, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

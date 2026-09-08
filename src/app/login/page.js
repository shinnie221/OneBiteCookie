'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, loginWithGoogle, forgotPassword, isAuthenticated, user } = useAuth();
  const toast = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'customer') {
        router.replace('/');
      } else {
        router.replace('/staff/dashboard');
      }
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        const data = await login(email, password);
        toast.success('Login successful');
        if (data.user.role === 'customer') {
          router.push('/');
        } else {
          router.push('/staff/dashboard');
        }
      } else {
        const data = await register(name, email, password);
        toast.success('Registration successful');
        router.push('/');
      }
    } catch (error) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const data = await loginWithGoogle();
      toast.success(`Welcome, ${data.user.name}!`);
      if (data.user.role === 'customer') {
        router.push('/');
      } else {
        router.push('/staff/dashboard');
      }
    } catch (error) {
      // Don't show error if user just closed the popup
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        toast.error(error.message || 'Google login failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setResetLoading(true);
    try {
      await forgotPassword(resetEmail.trim());
      setResetSent(true);
      toast.success('Password reset email sent!');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email');
      } else {
        toast.error(error.message || 'Failed to send reset email');
      }
    } finally {
      setResetLoading(false);
    }
  };

  // Forgot password modal
  if (showForgotPassword) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.header}>
            <Link href="/" className={styles.logo}>
              <span className={styles.logoIcon}>🍪</span>
              <span className={styles.logoText}>One Bite</span>
            </Link>
            <h2>Reset Password</h2>
            <p>Enter your email and we&apos;ll send you a link to reset your password.</p>
          </div>

          {resetSent ? (
            <div className={styles.resetSuccess}>
              <div className={styles.resetSuccessIcon}>✉️</div>
              <h3>Check your email</h3>
              <p>We&apos;ve sent a password reset link to <strong>{resetEmail}</strong></p>
              <p className={styles.resetNote}>Didn&apos;t receive the email? Check your spam folder or try again.</p>
              <button
                type="button"
                className="btn btnPrimary"
                style={{ width: '100%', marginTop: '16px' }}
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                  setResetEmail('');
                }}
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className={styles.form}>
              <div className="formGroup mb3">
                <label htmlFor="resetEmail">Email Address</label>
                <input
                  type="email"
                  id="resetEmail"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <button type="submit" className="btn btnPrimary" disabled={resetLoading} style={{ width: '100%' }}>
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.backLink}
              onClick={() => {
                setShowForgotPassword(false);
                setResetSent(false);
                setResetEmail('');
              }}
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoIcon}>🍪</span>
            <span className={styles.logoText}>One Bite</span>
          </Link>
          <h2>{isLogin ? 'Welcome Back' : 'Create an Account'}</h2>
          <p>{isLogin ? 'Please log in to continue.' : 'Sign up to place orders and track history.'}</p>
        </div>

        {/* Google Sign-In Button */}
        <div className={styles.socialLogin}>
          <button
            type="button"
            className={styles.googleBtn}
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            id="google-login-btn"
          >
            <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Signing in...' : `Sign ${isLogin ? 'in' : 'up'} with Google`}
          </button>
        </div>

        {/* Divider */}
        <div className={styles.divider}>
          <span>or</span>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          {!isLogin && (
            <div className="formGroup mb2">
              <label htmlFor="name">Full Name</label>
              <input 
                type="text" 
                id="name" 
                value={name}
                onChange={e => setName(e.target.value)}
                required={!isLogin} 
              />
            </div>
          )}
          <div className="formGroup mb2">
            <label htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
          </div>
          
          <div className="formGroup mb2">
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required 
            />
          </div>

          {isLogin && (
            <div className={styles.forgotPasswordRow}>
              <button
                type="button"
                className={styles.forgotPasswordBtn}
                onClick={() => {
                  setShowForgotPassword(true);
                  setResetEmail(email); // Pre-fill with current email
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          <div className="mb3" />
          
          <button type="submit" className="btn btnPrimary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>
        
        <div className={styles.toggleText}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button type="button" className={styles.toggleBtn} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Register here' : 'Login here'}
          </button>
        </div>

        <div className={styles.footer}>
          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

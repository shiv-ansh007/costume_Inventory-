'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      router.push('/catalog');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--gradient-soft)',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '24rem' }}>
        {/* Logo mark */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '2.5rem' }}>🎭</span>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--brand-primary)',
            margin: '0.5rem 0 0.25rem',
          }}>Welcome Back</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Sign in to your CostumeRent account</p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {error && (
            <div style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              background: '#FFF0F0',
              border: '1px solid #F5AABA',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            <div>
              <label htmlFor="email" className="form-label">Email address</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="form-label">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{ padding: '0.75rem', fontSize: '0.9375rem', marginTop: '0.25rem', width: '100%' }}
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

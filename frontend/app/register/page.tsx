'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setIsLoading(true);
    try {
      await register(name, email, password);
      router.push('/catalog');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
        {/* Brand logo & title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 0.75rem',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2.5px solid var(--brand-gold)',
            boxShadow: '0 4px 14px rgba(196,154,82,0.35)',
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src="/dgs-logo.jpg"
              alt="DGS's Creation Logo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--brand-primary)',
            margin: '0.25rem 0 0.25rem',
          }}>Create Your Account</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Join DGS&apos;s Creation CostumeRent
          </p>
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
              <label htmlFor="name" className="form-label">Full Name</label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                placeholder="Jane Doe"
              />
            </div>

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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Min. 6 characters"
              />
            </div>

            <button
              id="register-submit-btn"
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{ padding: '0.75rem', fontSize: '0.9375rem', marginTop: '0.25rem', width: '100%' }}
            >
              {isLoading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

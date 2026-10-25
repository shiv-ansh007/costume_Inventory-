'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { notificationsApi } from '@/lib/api';

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  orderId?: number;
  isRead: boolean;
  createdAt: string;
}

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await notificationsApi.getAll();
      if (res.success) {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const handleLogout = () => { logout(); router.push('/'); };

  const isActive = (href: string) => pathname === href;

  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      boxShadow: 'var(--shadow-nav)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '3.75rem' }}>

          {/* Logo */}
          <Link href="/" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            textDecoration: 'none',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid var(--brand-gold)',
              boxShadow: '0 2px 8px rgba(196,154,82,0.3)',
              background: '#000',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src="/dgs-logo.jpg"
                alt="DGS's Creation Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  // Fallback if image fails
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '1.15rem',
                fontWeight: 700,
                background: 'var(--gradient-brand)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.01em',
              }}>DGS's Creation</span>
              <span style={{
                fontSize: '0.625rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--brand-gold)',
                fontWeight: 600,
              }}>CostumeRent · Boutique</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div style={{ display: 'none' }} className="md-nav-links">
            {[
              { href: '/catalog', label: 'Catalog' },
              ...(user && !isAdmin ? [{ href: '/my-orders', label: 'My Orders' }] : []),
              ...(isAdmin ? [{ href: '/admin', label: 'Admin Dashboard' }] : []),
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: isActive(href) ? 600 : 500,
                  color: isActive(href) ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  background: isActive(href) ? 'var(--surface-muted)' : 'transparent',
                  transition: 'color 0.15s, background 0.15s',
                  position: 'relative',
                }}
              >
                {label}
                {isActive(href) && (
                  <span style={{
                    position: 'absolute',
                    bottom: '-0.75rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '1.5rem',
                    height: '2px',
                    background: 'var(--brand-primary)',
                    borderRadius: '1px',
                  }} />
                )}
              </Link>
            ))}
          </div>

          {/* Desktop Actions */}
          <div style={{ display: 'none' }} className="md-actions">
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* Notification Bell */}
                <div style={{ position: 'relative' }} ref={notifRef}>
                  <button
                    id="notifications-bell-btn"
                    onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchNotifications(); }}
                    aria-label="View notifications"
                    style={{
                      position: 'relative',
                      padding: '0.5rem',
                      borderRadius: '50%',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-muted)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand-primary)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                    }}
                  >
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        minWidth: '17px',
                        height: '17px',
                        padding: '0 4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#fff',
                        background: 'var(--brand-secondary)',
                        borderRadius: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--surface)',
                      }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {notifOpen && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 8px)',
                      width: '22rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '14px',
                      boxShadow: '0 16px 48px -8px rgba(143,18,63,0.18)',
                      overflow: 'hidden',
                      zIndex: 60,
                    }}>
                      <div style={{
                        padding: '0.75rem 1rem',
                        background: 'var(--surface-muted)',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</span>
                          {unreadCount > 0 && (
                            <span className="badge badge-rejected" style={{ fontSize: '0.65rem' }}>{unreadCount} new</span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllRead} style={{
                            fontSize: '0.7rem',
                            color: 'var(--brand-primary)',
                            fontWeight: 600,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}>Mark all read</button>
                        )}
                      </div>
                      <div style={{ maxHeight: '18rem', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            No notifications yet
                          </div>
                        ) : notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (!n.isRead) handleMarkAsRead(n.id);
                              router.push(isAdmin ? '/admin' : '/my-orders');
                              setNotifOpen(false);
                            }}
                            style={{
                              padding: '0.75rem 1rem',
                              cursor: 'pointer',
                              background: !n.isRead ? 'var(--surface-muted)' : 'var(--surface)',
                              borderBottom: '1px solid var(--border)',
                              transition: 'background 0.15s',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: !n.isRead ? 'var(--brand-primary)' : 'var(--text-primary)',
                              }}>{n.title}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.5 }}>{n.message}</p>
                            {!n.isRead && (
                              <div style={{ marginTop: '0.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand-secondary)', display: 'inline-block' }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* User name + admin badge */}
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  {user.name}
                  {isAdmin && (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.5rem',
                      borderRadius: '100px',
                      background: 'var(--surface-muted)',
                      color: 'var(--brand-primary)',
                      border: '1px solid var(--brand-blush)',
                      letterSpacing: '0.04em',
                    }}>ADMIN</span>
                  )}
                </span>

                <button
                  id="logout-btn"
                  onClick={handleLogout}
                  className="btn-secondary"
                  style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Link href="/login" style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  padding: '0.375rem 0.625rem',
                }}>Login</Link>
                <Link href="/register" className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8125rem' }}>
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              background: menuOpen ? 'var(--surface-muted)' : 'transparent',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
            className="mobile-only"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '0.75rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.125rem',
          }}>
            {[
              { href: '/catalog', label: '🎭 Catalog' },
              ...(user && !isAdmin ? [{ href: '/my-orders', label: '📦 My Orders' }] : []),
              ...(isAdmin ? [{ href: '/admin', label: '⚙️ Admin Dashboard' }] : []),
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: isActive(href) ? 600 : 400,
                  color: isActive(href) ? 'var(--brand-primary)' : 'var(--text-primary)',
                  background: isActive(href) ? 'var(--surface-muted)' : 'transparent',
                  borderRadius: '8px',
                  textDecoration: 'none',
                }}
              >{label}</Link>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
              {user ? (
                <button onClick={handleLogout} style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--error)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '8px',
                }}>🚪 Logout</button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <Link href="/login" onClick={() => setMenuOpen(false)} style={{
                    padding: '0.625rem 0.75rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    borderRadius: '8px',
                  }}>Login</Link>
                  <Link href="/register" onClick={() => setMenuOpen(false)} className="btn-primary" style={{ margin: '0 0.5rem' }}>
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .md-nav-links { display: flex !important; align-items: center; gap: 0.25rem; }
          .md-actions   { display: flex !important; align-items: center; }
          .mobile-only  { display: none !important; }
        }
      `}</style>
    </nav>
  );
}

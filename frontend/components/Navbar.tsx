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

  // Notification state
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
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000); // 15s poll
      return () => clearInterval(interval);
    }
  }, [user]);

  // Close dropdown on outside click
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
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
        pathname === href
          ? 'border-gray-900 text-gray-900'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link href="/" className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>🎭</span> CostumeRent
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLink('/catalog', 'Catalog')}
            {user && !isAdmin && navLink('/my-orders', 'My Orders')}
            {isAdmin && navLink('/admin', 'Admin Dashboard')}
          </div>

          {/* Auth & Notifications Actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {/* 🔔 Notification Bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    id="notifications-bell-btn"
                    onClick={() => {
                      setNotifOpen(!notifOpen);
                      if (!notifOpen) fetchNotifications();
                    }}
                    className="relative p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="View notifications"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown panel */}
                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-sm text-gray-400">
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                if (!n.isRead) handleMarkAsRead(n.id);
                                if (isAdmin) router.push('/admin');
                                else router.push('/my-orders');
                                setNotifOpen(false);
                              }}
                              className={`p-3 text-left transition-colors cursor-pointer hover:bg-gray-50 ${
                                !n.isRead ? 'bg-indigo-50/40' : 'bg-white'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-xs font-semibold ${!n.isRead ? 'text-indigo-900' : 'text-gray-900'}`}>
                                  {n.title}
                                </span>
                                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                                {n.message}
                              </p>
                              {!n.isRead && (
                                <div className="mt-1 flex justify-end">
                                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-600"></span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-sm text-gray-600">
                  {user.name} {isAdmin && <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">Admin</span>}
                </span>
                <button
                  id="logout-btn"
                  onClick={handleLogout}
                  className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-btn"
            className="md:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 py-3 flex flex-col gap-2">
            <Link href="/catalog" className="px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded" onClick={() => setMenuOpen(false)}>Catalog</Link>
            {user && !isAdmin && <Link href="/my-orders" className="px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded" onClick={() => setMenuOpen(false)}>My Orders</Link>}
            {isAdmin && <Link href="/admin" className="px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded" onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>}
            {user ? (
              <button onClick={handleLogout} className="text-left px-2 py-1.5 text-sm text-red-600 hover:bg-gray-50 rounded">Logout</button>
            ) : (
              <>
                <Link href="/login" className="px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link href="/register" className="px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded" onClick={() => setMenuOpen(false)}>Register</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { rentalsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface RentalOrder {
  id: number;
  startDate: string;
  endDate: string;
  quantity: number;
  totalPrice: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'CANCELLED';
  notes?: string;
  deliveryOption?: 'PICKUP' | 'HOME_DELIVERY';
  deliveryAddress?: string | null;
  contactPhone?: string | null;
  deliveryStatus?: 'PENDING_APPROVAL' | 'DELIVERY_APPROVED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  deliveryFee?: number;
  createdAt: string;
  product: { id: number; name: string; imageUrl?: string | null; category?: string | null };
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string; icon: string }> = {
  PENDING: { label: 'Pending Review', bg: 'rgba(169, 101, 18, 0.1)', color: 'var(--warning)', border: 'rgba(169, 101, 18, 0.3)', icon: '⏳' },
  APPROVED: { label: 'Approved & Active', bg: 'rgba(22, 131, 74, 0.1)', color: 'var(--success)', border: 'rgba(22, 131, 74, 0.3)', icon: '✓' },
  REJECTED: { label: 'Rejected', bg: 'rgba(192, 57, 75, 0.1)', color: 'var(--error)', border: 'rgba(192, 57, 75, 0.3)', icon: '✕' },
  RETURNED: { label: 'Returned', bg: 'rgba(143, 18, 63, 0.08)', color: 'var(--brand-primary)', border: 'rgba(143, 18, 63, 0.25)', icon: '📦' },
  CANCELLED: { label: 'Cancelled', bg: '#F1F1F1', color: '#796570', border: '#DCD4D7', icon: '—' },
};

const DELIVERY_CONFIG: Record<string, { label: string; icon: string; bg: string; color: string }> = {
  PENDING_APPROVAL: { label: 'Awaiting Delivery Approval', icon: '⏳', bg: 'rgba(169, 101, 18, 0.1)', color: 'var(--warning)' },
  DELIVERY_APPROVED: { label: 'Delivery Approved · Dispatching Soon', icon: '✅', bg: 'rgba(22, 131, 74, 0.1)', color: 'var(--success)' },
  OUT_FOR_DELIVERY: { label: 'Out for Doorstep Delivery', icon: '🚚', bg: 'rgba(194, 24, 91, 0.1)', color: 'var(--brand-secondary)' },
  DELIVERED: { label: 'Delivered', icon: '🎉', bg: 'rgba(22, 131, 74, 0.12)', color: 'var(--success)' },
};

export default function MyOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    rentalsApi
      .getMyOrders()
      .then((res) => setOrders(res.data))
      .catch(() => setError('Failed to load your orders'))
      .finally(() => setIsLoading(false));
  }, [user]);

  const handleCancel = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this booking request?')) return;
    setCancellingId(id);
    try {
      await rentalsApi.cancel(id);
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: 'CANCELLED' } : o));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Dashboard Stats
  const activeCount = orders.filter((o) => o.status === 'APPROVED').length;
  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const returnedCount = orders.filter((o) => o.status === 'RETURNED').length;
  const totalSpent = orders.filter((o) => o.status === 'APPROVED' || o.status === 'RETURNED')
    .reduce((acc, curr) => acc + Number(curr.totalPrice), 0);

  if (isLoading) {
    return (
      <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '3rem 1rem' }}>
        <div className="skeleton" style={{ height: '140px', borderRadius: 'var(--radius-card)', marginBottom: '2rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="skeleton" style={{ height: '80px', borderRadius: '8px' }} />
          <div className="skeleton" style={{ height: '80px', borderRadius: '8px' }} />
          <div className="skeleton" style={{ height: '80px', borderRadius: '8px' }} />
        </div>
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-card)' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '68rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      {/* Featured Plum Gradient Welcome Banner */}
      <div style={{
        background: 'var(--gradient-dashboard)',
        borderRadius: 'var(--radius-card)',
        padding: '2rem',
        color: '#FFFFFF',
        marginBottom: '2rem',
        boxShadow: '0 8px 24px rgba(36,21,29,0.25)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem',
      }}>
        <div>
          <span style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--brand-gold)',
            fontWeight: 700,
          }}>
            Client Dashboard
          </span>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.75rem',
            fontWeight: 700,
            margin: '0.35rem 0 0.5rem',
            letterSpacing: '-0.01em',
          }}>
            Welcome, {user?.name || 'Customer'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', margin: 0, maxWidth: '32rem' }}>
            Manage your boutique costume bookings, track doorstep deliveries, and view your rental history with DGS&apos;s Creation.
          </p>
        </div>

        <Link
          href="/catalog"
          className="btn-primary"
          style={{
            background: 'var(--surface)',
            color: 'var(--brand-primary)',
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          ✨ Book Another Outfit
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2.5rem',
      }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Rentals
          </span>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--brand-primary)',
            marginTop: '0.25rem',
          }}>
            {activeCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Confirmed bookings</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            In Review
          </span>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--warning)',
            marginTop: '0.25rem',
          }}>
            {pendingCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pending boutique approval</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Completed Orders
          </span>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '0.25rem',
          }}>
            {returnedCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Returned & closed</span>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Value
          </span>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--brand-gold)',
            marginTop: '0.25rem',
          }}>
            ₹{totalSpent.toFixed(0)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Approved rentals</span>
        </div>
      </div>

      {/* Orders List Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '1.35rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          Rental History ({orders.length})
        </h2>
      </div>

      {error && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '0.75rem 1rem',
          background: '#FFF0F0',
          border: '1px solid #F5AABA',
          borderRadius: '8px',
          color: 'var(--error)',
          fontSize: '0.875rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎭</span>
          <h3 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}>
            No costume bookings yet
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Explore our high-end boutique collection and book your dream costume today.
          </p>
          <Link href="/catalog" className="btn-primary" style={{ padding: '0.625rem 1.5rem' }}>
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {orders.map((order) => {
            const isHomeDelivery = order.deliveryOption === 'HOME_DELIVERY';
            const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const delInfo = order.deliveryStatus ? DELIVERY_CONFIG[order.deliveryStatus] : null;

            return (
              <div
                key={order.id}
                className="card"
                style={{
                  padding: '1.5rem',
                  border: '1px solid var(--border)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1.25rem',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}>
                  {/* Left: Product Thumbnail & Order Info */}
                  <div style={{ display: 'flex', gap: '1.25rem', flex: '1 1 300px', minWidth: '260px' }}>
                    <div style={{
                      position: 'relative',
                      width: '84px',
                      height: '104px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'var(--surface-muted)',
                      border: '1px solid var(--border)',
                      flexShrink: 0,
                    }}>
                      {order.product.imageUrl ? (
                        <Image
                          src={order.product.imageUrl}
                          alt={order.product.name}
                          fill
                          className="object-cover"
                          sizes="84px"
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '1.75rem' }}>
                          👗
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                      {/* Status Badges */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          background: statusInfo.bg,
                          color: statusInfo.color,
                          border: `1px solid ${statusInfo.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}>
                          <span>{statusInfo.icon}</span> {statusInfo.label}
                        </span>

                        {isHomeDelivery ? (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            background: 'rgba(194, 24, 91, 0.08)',
                            color: 'var(--brand-secondary)',
                            border: '1px solid rgba(194, 24, 91, 0.25)',
                          }}>
                            🚚 Home Delivery
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            background: 'var(--surface-muted)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                          }}>
                            🏪 Boutique Pickup
                          </span>
                        )}

                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          #{order.id}
                        </span>
                      </div>

                      {/* Product Name */}
                      <h3 style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        margin: '0.2rem 0 0',
                      }}>
                        {order.product.name}
                      </h3>

                      {/* Rental Duration */}
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Duration:</span>{' '}
                        {fmt(order.startDate)} → {fmt(order.endDate)} · <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Qty:</span> {order.quantity}
                      </div>

                      {/* Notes if any */}
                      {order.notes && (
                        <p style={{
                          fontSize: '0.75rem',
                          fontStyle: 'italic',
                          color: 'var(--text-secondary)',
                          background: 'var(--surface-muted)',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '6px',
                          margin: '0.35rem 0 0',
                        }}>
                          &ldquo;{order.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Price & Actions */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    minWidth: '140px',
                    textAlign: 'right',
                  }}>
                    <div>
                      <div style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: '1.35rem',
                        fontWeight: 700,
                        color: 'var(--brand-primary)',
                      }}>
                        ₹{Number(order.totalPrice).toFixed(0)}
                      </div>
                      {isHomeDelivery && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          Includes ₹50 delivery
                        </div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Booked on {fmt(order.createdAt)}
                      </div>
                    </div>

                    {order.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        style={{
                          marginTop: '1rem',
                          background: 'none',
                          border: 'none',
                          color: 'var(--error)',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {cancellingId === order.id ? 'Cancelling…' : 'Cancel Request'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Delivery Tracking Bar (if Home Delivery) */}
                {isHomeDelivery && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.875rem 1rem',
                    background: 'var(--brand-ivory)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    fontSize: '0.8125rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Dispatch Status:</span>
                      {delInfo && (
                        <span style={{
                          fontWeight: 600,
                          color: delInfo.color,
                          background: delInfo.bg,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}>
                          <span>{delInfo.icon}</span> {delInfo.label}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {order.deliveryAddress && (
                        <span>📍 <strong>Address:</strong> {order.deliveryAddress}</span>
                      )}
                      {order.contactPhone && (
                        <span>📞 <strong>Contact:</strong> {order.contactPhone}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

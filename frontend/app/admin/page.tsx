'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { rentalsApi, productsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  pendingDeliveries?: number;
  totalUsers: number;
  totalRevenue: number;
}

interface RentalOrder {
  id: number;
  startDate: string;
  endDate: string;
  quantity: number;
  totalPrice: number;
  status: string;
  notes?: string;
  deliveryOption?: 'PICKUP' | 'HOME_DELIVERY';
  deliveryAddress?: string | null;
  contactPhone?: string | null;
  deliveryStatus?: 'PENDING_APPROVAL' | 'DELIVERY_APPROVED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  deliveryFee?: number;
  createdAt: string;
  product: { id: number; name: string };
  user: { id: number; name: string; email: string };
}

interface Product {
  id: number;
  name: string;
  type: string;
  rentalPrice?: number | null;
  salePrice?: number | null;
  totalStock: number;
  category?: string | null;
  isActive: boolean;
  imageUrl?: string | null;
}

const STATUS_BADGES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING: { bg: 'rgba(169, 101, 18, 0.1)', color: 'var(--warning)', border: 'rgba(169, 101, 18, 0.3)', label: 'Pending' },
  APPROVED: { bg: 'rgba(22, 131, 74, 0.1)', color: 'var(--success)', border: 'rgba(22, 131, 74, 0.3)', label: 'Approved' },
  REJECTED: { bg: 'rgba(192, 57, 75, 0.1)', color: 'var(--error)', border: 'rgba(192, 57, 75, 0.3)', label: 'Rejected' },
  RETURNED: { bg: 'rgba(143, 18, 63, 0.08)', color: 'var(--brand-primary)', border: 'rgba(143, 18, 63, 0.25)', label: 'Returned' },
  CANCELLED: { bg: '#F1F1F1', color: '#796570', border: '#DCD4D7', label: 'Cancelled' },
};

const DELIVERY_STATUS_STYLES: Record<string, { label: string; bg: string; color: string; border: string; icon: string }> = {
  PENDING_APPROVAL: { label: 'Awaiting Approval', bg: 'rgba(169, 101, 18, 0.1)', color: 'var(--warning)', border: 'rgba(169, 101, 18, 0.3)', icon: '⏳' },
  DELIVERY_APPROVED: { label: 'Delivery Approved', bg: 'rgba(22, 131, 74, 0.1)', color: 'var(--success)', border: 'rgba(22, 131, 74, 0.3)', icon: '✓' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', bg: 'rgba(194, 24, 91, 0.1)', color: 'var(--brand-secondary)', border: 'rgba(194, 24, 91, 0.3)', icon: '🚚' },
  DELIVERED: { label: 'Delivered', bg: 'rgba(22, 131, 74, 0.15)', color: 'var(--success)', border: 'rgba(22, 131, 74, 0.35)', icon: '🎉' },
};

function buildWhatsAppUrl(phone: string, text: string) {
  let cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone; // Default to India (+91) if 10 digits
  }
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    : `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

function generateWhatsAppMessage(
  order: RentalOrder,
  templateType: 'APPROVAL' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURN_REMINDER'
) {
  const isHomeDel = order.deliveryOption === 'HOME_DELIVERY';
  const fmtStart = new Date(order.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtEnd = new Date(order.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  if (templateType === 'APPROVAL') {
    return (
`✨ *DGS's CREATION — COSTUMERENT*
*Order Approval Confirmation*

Hello *${order.user.name}*,
Great news! Your costume rental request *#${order.id}* has been *APPROVED*! ✅

📋 *Order Details:*
• *Item:* ${order.product.name}
• *Quantity:* ${order.quantity} unit(s)
• *Rental Dates:* ${fmtStart} ➡️ ${fmtEnd}
• *Fulfillment:* ${isHomeDel ? '🚚 Home Delivery (+₹50)' : '🏪 Boutique Store Pickup'}
${order.deliveryAddress ? `• *Delivery Address:* ${order.deliveryAddress}\n` : ''}• *Total Amount:* ₹${Number(order.totalPrice).toFixed(0)}

${isHomeDel 
  ? '🚚 *Home Delivery:* Your order is approved and our team is preparing it for doorstep dispatch.' 
  : `🏪 *Store Pickup:* Your costume is reserved and ready for pickup at our boutique on ${fmtStart}.`}

Thank you for choosing DGS's Creation! Reply directly here on WhatsApp if you need any adjustments. 💬`
    );
  }

  if (templateType === 'OUT_FOR_DELIVERY') {
    return (
`🚚 *DGS's CREATION — DISPATCH UPDATE*

Hello *${order.user.name}*,
Your costume rental order *#${order.id}* (*${order.product.name}*) is now *OUT FOR DELIVERY*! 📦

📍 *Delivery Address:* ${order.deliveryAddress || 'Address on file'}
📞 *Contact Phone:* ${order.contactPhone || 'N/A'}
💰 *Total Amount:* ₹${Number(order.totalPrice).toFixed(0)}

Our courier will arrive shortly. Please keep your phone reachable! 💬`
    );
  }

  if (templateType === 'DELIVERED') {
    return (
`🎉 *DGS's CREATION — ORDER DELIVERED*

Hello *${order.user.name}*,
Your costume rental order *#${order.id}* (*${order.product.name}*) has been successfully *DELIVERED*! 📦

Please inspect your costume and matching accessories.
Rental return date: *${fmtEnd}*.

We hope you have a spectacular event! 🎭✨`
    );
  }

  if (templateType === 'RETURN_REMINDER') {
    return (
`⏰ *DGS's CREATION — RETURN REMINDER*

Hello *${order.user.name}*,
Friendly reminder that your costume rental for *"${order.product.name}"* (Order *#${order.id}*) is scheduled for return on *${fmtEnd}*.

Please ensure the costume and accessories are packed and ready for return. Thank you! 🎭`
    );
  }

  return '';
}

// ─── StatCard Component ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, gold }: { label: string; value: string | number; sub?: string; gold?: boolean }) {
  return (
    <div className="card" style={{
      padding: '1.25rem',
      border: gold ? '1px solid var(--brand-gold)' : '1px solid var(--border)',
      background: gold ? 'linear-gradient(135deg, #FFFFFF 0%, #FFFDF9 100%)' : 'var(--surface)',
    }}>
      <p style={{
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.35rem',
        fontWeight: 600,
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: '1.75rem',
        fontWeight: 700,
        color: gold ? 'var(--brand-gold)' : 'var(--brand-primary)',
        lineHeight: 1.2,
      }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>{sub}</p>}
    </div>
  );
}

// ─── OrdersTab Component ───────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState<number | null>(null);

  // WhatsApp Redirect & Message Modal States
  const [waOrder, setWaOrder] = useState<RentalOrder | null>(null);
  const [waTemplate, setWaTemplate] = useState<'APPROVAL' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURN_REMINDER'>('APPROVAL');
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waCopied, setWaCopied] = useState(false);

  const handleOpenWhatsApp = (order: RentalOrder, template: 'APPROVAL' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURN_REMINDER' = 'APPROVAL') => {
    setWaOrder(order);
    setWaTemplate(template);
    setWaPhone(order.contactPhone || '');
    setWaMessage(generateWhatsAppMessage(order, template));
    setWaCopied(false);
  };

  const handleTemplateChange = (type: 'APPROVAL' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURN_REMINDER') => {
    setWaTemplate(type);
    if (waOrder) {
      setWaMessage(generateWhatsAppMessage(waOrder, type));
    }
  };

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await rentalsApi.getAllOrders(params);
      setOrders(res.data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await rentalsApi.updateStatus(id, status);
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));

      if (status === 'APPROVED') {
        const approvedOrder = orders.find((o) => o.id === id);
        if (approvedOrder) {
          handleOpenWhatsApp({ ...approvedOrder, status: 'APPROVED' }, 'APPROVAL');
        }
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const updateDeliveryStatus = async (id: number, deliveryStatus: string) => {
    setUpdatingDeliveryId(id);
    try {
      await rentalsApi.updateDeliveryStatus(id, deliveryStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, deliveryStatus: deliveryStatus as any } : o))
      );

      if (deliveryStatus === 'OUT_FOR_DELIVERY' || deliveryStatus === 'DELIVERED') {
        const orderToMsg = orders.find((o) => o.id === id);
        if (orderToMsg) {
          handleOpenWhatsApp(
            { ...orderToMsg, deliveryStatus: deliveryStatus as any },
            deliveryStatus === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'DELIVERED'
          );
        }
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delivery status update failed');
    } finally {
      setUpdatingDeliveryId(null);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const filteredOrders = orders.filter((o) => {
    if (!deliveryFilter) return true;
    if (deliveryFilter === 'PICKUP') return o.deliveryOption === 'PICKUP';
    if (deliveryFilter === 'HOME_DELIVERY') return o.deliveryOption === 'HOME_DELIVERY';
    if (deliveryFilter === 'NEEDS_APPROVAL') return o.deliveryOption === 'HOME_DELIVERY' && o.deliveryStatus === 'PENDING_APPROVAL';
    return true;
  });

  return (
    <div>
      {/* Filters Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
        background: 'var(--surface)',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border)',
      }}>
        <div>
          <label className="form-label" style={{ marginBottom: '0.35rem' }}>Rental Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input"
            style={{ width: 'auto', minWidth: '160px', padding: '0.45rem 0.75rem' }}
          >
            <option value="">All Rental Statuses</option>
            {['PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label" style={{ marginBottom: '0.35rem' }}>Fulfillment Method</label>
          <select
            id="delivery-filter"
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            className="form-input"
            style={{ width: 'auto', minWidth: '190px', padding: '0.45rem 0.75rem' }}
          >
            <option value="">All Fulfillment Modes</option>
            <option value="NEEDS_APPROVAL">⏳ Needs Delivery Approval</option>
            <option value="HOME_DELIVERY">🚚 Home Delivery (All)</option>
            <option value="PICKUP">🏪 Store Pickup</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Showing <strong style={{ color: 'var(--brand-primary)' }}>{filteredOrders.length}</strong> of {orders.length} order(s)
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="skeleton" style={{ height: '220px', borderRadius: 'var(--radius-card)' }} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📋</span>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            No orders match the selected filters
          </p>
          <p style={{ fontSize: '0.8125rem' }}>Try choosing another status or reset filters.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{
                  background: 'var(--surface-muted)',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  fontSize: '0.6875rem',
                  letterSpacing: '0.06em',
                }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Order</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Client</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Costume & Dates</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Fulfillment</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Amount</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status & Review</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Dispatch Flow</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isHomeDel = order.deliveryOption === 'HOME_DELIVERY';
                  const delInfo = order.deliveryStatus ? DELIVERY_STATUS_STYLES[order.deliveryStatus] : null;
                  const stat = STATUS_BADGES[order.status] || STATUS_BADGES.PENDING;

                  return (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-muted)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Order ID */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                          #{order.id}
                        </span>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {fmt(order.createdAt)}
                        </div>
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{order.user.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{order.user.email}</div>
                      </td>

                      {/* Product & Dates */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', maxWidth: '240px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{order.product.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--brand-gold)', fontWeight: 600, marginTop: '0.15rem' }}>
                          {fmt(order.startDate)} ➔ {fmt(order.endDate)}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Quantity: {order.quantity}</div>
                        {order.notes && (
                          <div style={{
                            fontSize: '0.6875rem',
                            fontStyle: 'italic',
                            color: 'var(--text-secondary)',
                            background: 'var(--brand-ivory)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            marginTop: '0.35rem',
                          }}>
                            &ldquo;{order.notes}&rdquo;
                          </div>
                        )}
                      </td>

                      {/* Fulfillment */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', maxWidth: '220px' }}>
                        {isHomeDel ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              color: 'var(--brand-secondary)',
                              background: 'rgba(194, 24, 91, 0.08)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '9999px',
                              width: 'fit-content',
                            }}>
                              🚚 Home Delivery (+₹50)
                            </span>
                            {order.deliveryAddress && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                📍 {order.deliveryAddress}
                              </div>
                            )}
                            {order.contactPhone && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                📞 {order.contactPhone}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            background: 'var(--surface-muted)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                          }}>
                            🏪 Boutique Pickup
                          </span>
                        )}
                      </td>

                      {/* Total Price */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <div style={{
                          fontFamily: "'Playfair Display', Georgia, serif",
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: 'var(--brand-primary)',
                        }}>
                          ₹{Number(order.totalPrice).toFixed(0)}
                        </div>
                      </td>

                      {/* Rental Order Status & Review Actions */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: stat.bg,
                            color: stat.color,
                            border: `1px solid ${stat.border}`,
                            width: 'fit-content',
                          }}>
                            {stat.label}
                          </span>

                          {order.status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button
                                onClick={() => updateStatus(order.id, 'APPROVED')}
                                disabled={updatingId === order.id}
                                style={{
                                  fontSize: '0.6875rem',
                                  padding: '0.25rem 0.5rem',
                                  background: 'var(--success)',
                                  color: '#FFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateStatus(order.id, 'REJECTED')}
                                disabled={updatingId === order.id}
                                style={{
                                  fontSize: '0.6875rem',
                                  padding: '0.25rem 0.5rem',
                                  background: 'var(--error)',
                                  color: '#FFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {order.status === 'APPROVED' && (
                            <button
                              onClick={() => updateStatus(order.id, 'RETURNED')}
                              disabled={updatingId === order.id}
                              style={{
                                fontSize: '0.6875rem',
                                padding: '0.25rem 0.5rem',
                                background: 'var(--brand-primary)',
                                color: '#FFF',
                                border: 'none',
                                borderRadius: '4px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                width: 'fit-content',
                              }}
                            >
                              Mark Returned
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenWhatsApp(order, 'APPROVAL')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: 'var(--success)',
                              background: 'rgba(22, 131, 74, 0.08)',
                              border: '1px solid rgba(22, 131, 74, 0.25)',
                              padding: '0.2rem 0.45rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              width: 'fit-content',
                            }}
                          >
                            <span>💬</span> WhatsApp
                          </button>
                        </div>
                      </td>

                      {/* Dispatch Flow */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', minWidth: '190px' }}>
                        {isHomeDel ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {delInfo && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                background: delInfo.bg,
                                color: delInfo.color,
                                border: `1px solid ${delInfo.border}`,
                                width: 'fit-content',
                              }}>
                                <span>{delInfo.icon}</span> {delInfo.label}
                              </span>
                            )}

                            {order.deliveryStatus === 'PENDING_APPROVAL' && (
                              <button
                                onClick={() => updateDeliveryStatus(order.id, 'DELIVERY_APPROVED')}
                                disabled={updatingDeliveryId === order.id}
                                className="btn-primary"
                                style={{
                                  fontSize: '0.6875rem',
                                  padding: '0.35rem 0.6rem',
                                  width: 'fit-content',
                                }}
                              >
                                ✓ Approve Delivery
                              </button>
                            )}

                            {order.deliveryStatus === 'DELIVERY_APPROVED' && (
                              <button
                                onClick={() => updateDeliveryStatus(order.id, 'OUT_FOR_DELIVERY')}
                                disabled={updatingDeliveryId === order.id}
                                style={{
                                  fontSize: '0.6875rem',
                                  padding: '0.35rem 0.6rem',
                                  background: 'var(--brand-secondary)',
                                  color: '#FFF',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  width: 'fit-content',
                                }}
                              >
                                🚚 Dispatch / Out for Delivery
                              </button>
                            )}

                            {order.deliveryStatus === 'OUT_FOR_DELIVERY' && (
                              <button
                                onClick={() => updateDeliveryStatus(order.id, 'DELIVERED')}
                                disabled={updatingDeliveryId === order.id}
                                style={{
                                  fontSize: '0.6875rem',
                                  padding: '0.35rem 0.6rem',
                                  background: 'var(--success)',
                                  color: '#FFF',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  width: 'fit-content',
                                }}
                              >
                                📦 Mark Delivered
                              </button>
                            )}

                            {/* Status Override */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Set:</span>
                              <select
                                value={order.deliveryStatus || 'PENDING_APPROVAL'}
                                onChange={(e) => updateDeliveryStatus(order.id, e.target.value)}
                                disabled={updatingDeliveryId === order.id}
                                style={{
                                  fontSize: '0.6875rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: '4px',
                                  padding: '0.15rem 0.35rem',
                                  background: 'var(--surface)',
                                }}
                              >
                                <option value="PENDING_APPROVAL">Pending Approval</option>
                                <option value="DELIVERY_APPROVED">Approved</option>
                                <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                                <option value="DELIVERED">Delivered</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            Customer self pickup
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── WhatsApp Customization & Redirect Modal ─── */}
      {waOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          background: 'rgba(36,21,29,0.6)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card" style={{
            maxWidth: '32rem',
            width: '100%',
            padding: 0,
            overflow: 'hidden',
            border: '1px solid var(--brand-gold)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          }}>
            {/* Header */}
            <div style={{
              background: 'var(--gradient-dashboard)',
              padding: '1.25rem 1.5rem',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>💬</span>
                <div>
                  <h3 style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    margin: 0,
                  }}>
                    WhatsApp Notification
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--brand-gold)', margin: 0 }}>
                    Order #{waOrder.id} · {waOrder.user.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FFF',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  opacity: 0.8,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Client Mobile / WhatsApp Number</label>
                <input
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="e.g. 9876543210 (with or without 91)"
                  className="form-input"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '0.4rem' }}>Message Template</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {(
                    [
                      { key: 'APPROVAL', label: '✅ Order Approved' },
                      { key: 'OUT_FOR_DELIVERY', label: '🚚 Out for Delivery' },
                      { key: 'DELIVERED', label: '🎉 Delivered' },
                      { key: 'RETURN_REMINDER', label: '⏰ Return Reminder' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleTemplateChange(t.key)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: waTemplate === t.key ? '1px solid var(--brand-primary)' : '1px solid var(--border)',
                        background: waTemplate === t.key ? 'var(--surface-muted)' : 'var(--surface)',
                        color: waTemplate === t.key ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">Preview & Edit Message</label>
                <textarea
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  rows={7}
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: 1.4 }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(waMessage);
                    setWaCopied(true);
                    setTimeout(() => setWaCopied(false), 2000);
                  }}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '0.625rem' }}
                >
                  {waCopied ? '✓ Copied!' : '📋 Copy Text'}
                </button>

                <a
                  href={buildWhatsAppUrl(waPhone, waMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{
                    flex: 1.5,
                    padding: '0.625rem',
                    textAlign: 'center',
                    background: 'var(--success)',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    textDecoration: 'none',
                  }}
                >
                  <span>💬 Open WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProductForm Modal ─────────────────────────────────────────────────────────
function ProductForm({ product, onSave, onCancel }: {
  product?: Product | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState('');
  const [type, setType] = useState(product?.type || 'RENT');
  const [rentalPrice, setRentalPrice] = useState(product?.rentalPrice ? String(product.rentalPrice) : '');
  const [salePrice, setSalePrice] = useState(product?.salePrice ? String(product.salePrice) : '');
  const [totalStock, setTotalStock] = useState(product?.totalStock ? String(product.totalStock) : '1');
  const [category, setCategory] = useState(product?.category || '');
  const [image, setImage] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState(product?.imageUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('type', type);
    if (rentalPrice) formData.append('rentalPrice', rentalPrice);
    if (salePrice) formData.append('salePrice', salePrice);
    formData.append('totalStock', totalStock);
    if (category) formData.append('category', category);
    if (image) formData.append('image', image);
    if (imageUrlInput) formData.append('imageUrl', imageUrlInput);

    try {
      let res;
      if (product) {
        res = await productsApi.update(product.id, formData);
      } else {
        res = await productsApi.create(formData);
      }
      if (!res.success) throw new Error(res.message || 'Failed to save product');
      onSave();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: 'rgba(36,21,29,0.6)',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="card" style={{
        maxWidth: '30rem',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '1.75rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--brand-primary)',
            margin: 0,
          }}>
            {product ? 'Edit Boutique Outfit' : 'Add New Costume'}
          </h2>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.625rem 0.875rem',
            background: '#FFF0F0',
            border: '1px solid #F5AABA',
            borderRadius: '6px',
            color: 'var(--error)',
            fontSize: '0.8125rem',
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label className="form-label">Costume Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              placeholder="e.g. Royal Victorian Ball Gown"
            />
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="form-input"
              placeholder="Fabric details, accessories included, fit details..."
              style={{ resize: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Listing Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="form-input">
                <option value="RENT">RENT ONLY</option>
                <option value="SALE">SALE ONLY</option>
                <option value="BOTH">RENT OR SALE</option>
              </select>
            </div>
            <div>
              <label className="form-label">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Historical, Bridal"
                className="form-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Rental (₹/day)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={rentalPrice}
                onChange={(e) => setRentalPrice(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Sale Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Total Stock *</label>
              <input
                type="number"
                min="1"
                required
                value={totalStock}
                onChange={(e) => setTotalStock(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Upload Costume Photo</label>
            <input
              id="product-image-input"
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="form-input"
              style={{ padding: '0.4rem' }}
            />
          </div>

          <div>
            <label className="form-label">Or Direct Image URL</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              className="form-input"
            />
            {product?.imageUrl && !image && (
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Current image: {product.imageUrl.slice(0, 45)}…
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              style={{ flex: 1, padding: '0.625rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ flex: 1, padding: '0.625rem' }}
            >
              {isSubmitting ? 'Saving…' : 'Save Costume'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CatalogTab Component ──────────────────────────────────────────────────────
function CatalogTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await productsApi.getAllAdmin();
      setProducts(res.data);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this costume from catalog?')) return;
    try {
      await productsApi.delete(id);
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, isActive: false } : p));
    } catch { /* ignore */ }
  };

  return (
    <div>
      {(showForm || editProduct) && (
        <ProductForm
          product={editProduct}
          onSave={() => { setShowForm(false); setEditProduct(null); fetchProducts(); }}
          onCancel={() => { setShowForm(false); setEditProduct(null); }}
        />
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
      }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {products.length} catalog item(s) total
        </span>
        <button
          id="add-product-btn"
          onClick={() => { setEditProduct(null); setShowForm(true); }}
          className="btn-primary"
          style={{ padding: '0.5rem 1rem' }}
        >
          ✨ + Add Costume
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="skeleton" style={{ height: '220px', borderRadius: 'var(--radius-card)' }} />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{
                  background: 'var(--surface-muted)',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  fontSize: '0.6875rem',
                  letterSpacing: '0.06em',
                }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Costume</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Rental ₹</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Sale ₹</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Stock</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-muted)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.name}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>{p.type}</td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--brand-gold)', fontWeight: 600 }}>{p.category || '—'}</td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                      {p.rentalPrice ? `₹${Number(p.rentalPrice).toFixed(0)}` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)' }}>
                      {p.salePrice ? `₹${Number(p.salePrice).toFixed(0)}` : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>{p.totalStock}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: p.isActive ? 'rgba(22, 131, 74, 0.1)' : '#F1F1F1',
                        color: p.isActive ? 'var(--success)' : '#796570',
                        border: `1px solid ${p.isActive ? 'rgba(22, 131, 74, 0.3)' : '#DCD4D7'}`,
                      }}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => { setEditProduct(p); setShowForm(true); }}
                          className="btn-secondary"
                          style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem' }}
                        >
                          Edit
                        </button>
                        {p.isActive && (
                          <button
                            onClick={() => handleDelete(p.id)}
                            style={{
                              fontSize: '0.6875rem',
                              padding: '0.25rem 0.5rem',
                              background: 'none',
                              border: '1px solid var(--error)',
                              color: 'var(--error)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'catalog'>('orders');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) router.push('/');
  }, [user, isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    rentalsApi.getDashboard().then((res) => setStats(res.data)).catch(() => {});
  }, [isAdmin]);

  if (authLoading || !isAdmin) return null;

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
      {/* Admin Title Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid var(--brand-gold)',
            boxShadow: '0 2px 8px rgba(196,154,82,0.3)',
            background: '#000',
            flexShrink: 0,
          }}>
            <img
              src="/dgs-logo.jpg"
              alt="DGS Logo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}>
              Boutique Operations Portal
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>
              DGS&apos;s Creation · Rental inventory & delivery administration
            </p>
          </div>
        </div>

        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--brand-primary)',
          background: 'var(--surface-muted)',
          border: '1px solid var(--brand-blush)',
          padding: '0.35rem 0.75rem',
          borderRadius: '9999px',
        }}>
          🛡️ Administrator: {user?.name}
        </span>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <StatCard label="Total Costumes" value={stats.totalProducts} />
          <StatCard label="Total Orders" value={stats.totalOrders} />
          <StatCard label="Pending Orders" value={stats.pendingOrders} sub="Awaiting review" />
          <StatCard label="Delivery Approvals" value={stats.pendingDeliveries ?? 0} sub="Needs dispatch" />
          <StatCard label="Registered Clients" value={stats.totalUsers} />
          <StatCard label="Total Revenue" value={`₹${Number(stats.totalRevenue).toFixed(0)}`} sub="Approved orders" gold />
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: '1.75rem',
        gap: '0.5rem',
      }}>
        {(['orders', 'catalog'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: isActive ? '2.5px solid var(--brand-primary)' : '2.5px solid transparent',
                background: isActive ? 'var(--surface-muted)' : 'transparent',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'orders' ? '📋 Rental Bookings & Deliveries' : '👗 Costume Inventory'}
            </button>
          );
        })}
      </div>

      {activeTab === 'orders' ? <OrdersTab /> : <CatalogTab />}
    </div>
  );
}

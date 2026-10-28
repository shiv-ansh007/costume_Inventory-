'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'CANCELLED' | string;
  notes?: string;
  deliveryOption?: 'PICKUP' | 'HOME_DELIVERY';
  deliveryAddress?: string | null;
  contactPhone?: string | null;
  deliveryStatus?: 'PENDING_APPROVAL' | 'DELIVERY_APPROVED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  deliveryFee?: number;
  createdAt: string;
  product: { id: number; name: string; imageUrl?: string | null };
  user: { id: number; name: string; email: string };
}

interface Product {
  id: number;
  name: string;
  description?: string;
  type: 'RENT' | 'SALE' | 'BOTH' | string;
  rentalPrice?: number | null;
  salePrice?: number | null;
  totalStock: number;
  category?: string | null;
  isActive: boolean;
  imageUrl?: string | null;
  createdAt?: string;
}

const DEFAULT_STANDARD_CATEGORIES = [
  'Cosplay',
  'Adult',
  'Kids',
  'Accessories',
  'Historical',
  'Fantasy',
  'Bollywood',
  'Superhero',
  'Festive',
  'Bridal & Formal',
  'Western',
];

// ─── Flow Stage Computation ────────────────────────────────────────────────────
type OrderFlowStage = 'STEP_1_PENDING' | 'STEP_2_CONFIRMED' | 'STEP_3_DISPATCHED' | 'STEP_4_COMPLETED' | 'TERMINATED';

function getOrderFlowStage(order: RentalOrder): OrderFlowStage {
  if (order.status === 'REJECTED' || order.status === 'CANCELLED') {
    return 'TERMINATED';
  }
  if (order.status === 'RETURNED') {
    return 'STEP_4_COMPLETED';
  }
  if (order.status === 'PENDING') {
    return 'STEP_1_PENDING';
  }
  // status === 'APPROVED'
  if (order.deliveryOption === 'HOME_DELIVERY') {
    if (order.deliveryStatus === 'OUT_FOR_DELIVERY' || order.deliveryStatus === 'DELIVERED') {
      return 'STEP_3_DISPATCHED';
    }
    return 'STEP_2_CONFIRMED';
  }
  // PICKUP
  return 'STEP_2_CONFIRMED';
}

function getNextActionConfig(order: RentalOrder): {
  canAdvance: boolean;
  buttonLabel: string;
  buttonIcon: string;
  nextDescription: string;
  actionType: 'STATUS' | 'DELIVERY';
  targetValue: string;
} | null {
  if (order.status === 'REJECTED' || order.status === 'CANCELLED' || order.status === 'RETURNED') {
    return null;
  }

  // 1. Pending ➔ Approve
  if (order.status === 'PENDING') {
    return {
      canAdvance: true,
      buttonLabel: 'Approve & Reserve Stock',
      buttonIcon: '⚡',
      nextDescription: 'Reserves inventory stock and confirms order for client',
      actionType: 'STATUS',
      targetValue: 'APPROVED',
    };
  }

  // 2. Approved ➔ Dispatch (Home Delivery)
  if (order.status === 'APPROVED' && order.deliveryOption === 'HOME_DELIVERY') {
    if (order.deliveryStatus === 'PENDING_APPROVAL' || order.deliveryStatus === 'DELIVERY_APPROVED') {
      return {
        canAdvance: true,
        buttonLabel: 'Dispatch Out for Delivery',
        buttonIcon: '🚚',
        nextDescription: 'Hands parcel to courier & triggers live delivery tracking',
        actionType: 'DELIVERY',
        targetValue: 'OUT_FOR_DELIVERY',
      };
    }
    if (order.deliveryStatus === 'OUT_FOR_DELIVERY') {
      return {
        canAdvance: true,
        buttonLabel: 'Mark Delivered to Doorstep',
        buttonIcon: '📦',
        nextDescription: 'Confirms customer received the outfit at their address',
        actionType: 'DELIVERY',
        targetValue: 'DELIVERED',
      };
    }
  }

  // 3. Delivered or Pickup ➔ Mark Returned & Restock
  if (
    order.status === 'APPROVED' &&
    (order.deliveryOption === 'PICKUP' || order.deliveryStatus === 'DELIVERED')
  ) {
    return {
      canAdvance: true,
      buttonLabel: 'Mark Returned & Restock',
      buttonIcon: '🔄',
      nextDescription: 'Client returned outfit. Restores stock to inventory',
      actionType: 'STATUS',
      targetValue: 'RETURNED',
    };
  }

  return null;
}

// ─── WhatsApp Link Generator ───────────────────────────────────────────────────
function buildWhatsAppUrl(phone: string, text: string) {
  let cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    : `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

function generateStageWhatsAppMessage(order: RentalOrder) {
  const isHomeDel = order.deliveryOption === 'HOME_DELIVERY';
  const fmtStart = new Date(order.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtEnd = new Date(order.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const stage = getOrderFlowStage(order);

  if (stage === 'STEP_1_PENDING') {
    return `✨ *DGS's CREATION — COSTUMERENT*\nHello *${order.user.name}*, we have received your rental request *#${order.id}* for *"${order.product.name}"*. Our team is reviewing availability for *${fmtStart} to ${fmtEnd}* and will update you shortly! 💬`;
  }
  if (stage === 'STEP_2_CONFIRMED') {
    return `✨ *DGS's CREATION — COSTUMERENT*\n*Order Approval Confirmation* ✅\n\nHello *${order.user.name}*,\nGreat news! Your costume rental request *#${order.id}* (*${order.product.name}*) is *APPROVED*!\n\n📋 *Details:*\n• Quantity: ${order.quantity}\n• Rental Dates: ${fmtStart} ➡️ ${fmtEnd}\n• Mode: ${isHomeDel ? '🚚 Home Delivery (+₹50)' : '🏪 Boutique Store Pickup'}\n${order.deliveryAddress ? '• Address: ' + order.deliveryAddress + '\n' : ''}• Total: ₹${Number(order.totalPrice).toFixed(0)}\n\n${isHomeDel ? '🚚 Our dispatch team is preparing your package.' : `🏪 Ready for store pickup on ${fmtStart}.`}\n\nThank you for choosing DGS's Creation!`;
  }
  if (stage === 'STEP_3_DISPATCHED') {
    return `🚚 *DGS's CREATION — DISPATCH UPDATE*\n\nHello *${order.user.name}*,\nYour costume rental order *#${order.id}* (*${order.product.name}*) is now *${order.deliveryStatus === 'DELIVERED' ? 'DELIVERED' : 'OUT FOR DELIVERY'}*!\n\n📍 Address: ${order.deliveryAddress || 'Address on file'}\n📞 Contact: ${order.contactPhone || 'N/A'}\n💰 Total Amount: ₹${Number(order.totalPrice).toFixed(0)}\n\nHave a spectacular event! 🎭✨`;
  }
  if (stage === 'STEP_4_COMPLETED') {
    return `🎉 *DGS's CREATION — RENTAL COMPLETE*\n\nHello *${order.user.name}*,\nThank you for returning *"${order.product.name}"* (Order *#${order.id}*). Your rental order is officially completed and closed.\n\nWe look forward to styling your next occasion! 👑✨`;
  }
  return `Hello *${order.user.name}*, regarding your costume rental order #${order.id} for "${order.product.name}".`;
}

// ─── StatCard Component ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, gold, icon }: {
  label: string;
  value: string | number;
  sub?: string;
  gold?: boolean;
  icon?: string;
}) {
  return (
    <div className="card" style={{
      padding: '1.25rem',
      border: gold ? '1px solid var(--brand-gold)' : '1px solid var(--border)',
      background: gold ? 'linear-gradient(135deg, #FFFFFF 0%, #FFFDF9 100%)' : 'var(--surface)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {icon && (
        <span style={{
          position: 'absolute',
          right: '0.85rem',
          top: '0.85rem',
          fontSize: '1.5rem',
          opacity: 0.2,
        }}>
          {icon}
        </span>
      )}
      <p style={{
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
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

// ─── Visual Order Flow Stepper Bar ─────────────────────────────────────────────
function OrderFlowStepper({ order }: { order: RentalOrder }) {
  const stage = getOrderFlowStage(order);

  if (stage === 'TERMINATED') {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.25rem 0.65rem',
        borderRadius: '100px',
        background: '#FFF0F0',
        color: 'var(--error)',
        border: '1px solid #F5AABA',
        fontSize: '0.75rem',
        fontWeight: 600,
      }}>
        <span>✕</span> Order {order.status === 'REJECTED' ? 'Declined' : 'Cancelled'}
      </div>
    );
  }

  const steps = [
    { key: 'STEP_1_PENDING', num: 1, label: 'Requested' },
    { key: 'STEP_2_CONFIRMED', num: 2, label: 'Confirmed' },
    { key: 'STEP_3_DISPATCHED', num: 3, label: order.deliveryOption === 'HOME_DELIVERY' ? 'Dispatched' : 'Ready / In-Use' },
    { key: 'STEP_4_COMPLETED', num: 4, label: 'Returned' },
  ];

  const currentIdx = steps.findIndex((s) => s.key === stage);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: '100%', maxWidth: '380px' }}>
      {steps.map((step, idx) => {
        const isDone = idx < currentIdx || stage === 'STEP_4_COMPLETED';
        const isCurrent = idx === currentIdx && stage !== 'STEP_4_COMPLETED';
        const isFuture = idx > currentIdx && stage !== 'STEP_4_COMPLETED';

        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: idx < steps.length - 1 ? 1 : 'none' }}>
            {/* Step Circle & Label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '48px' }}>
              <div style={{
                width: isCurrent ? '24px' : '20px',
                height: isCurrent ? '24px' : '20px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6875rem',
                fontWeight: 700,
                background: isDone ? 'var(--success)' : isCurrent ? 'var(--brand-primary)' : 'var(--surface-muted)',
                color: isDone || isCurrent ? '#FFFFFF' : 'var(--text-secondary)',
                border: isCurrent ? '2px solid var(--brand-gold)' : isDone ? '1px solid var(--success)' : '1px solid var(--border)',
                boxShadow: isCurrent ? '0 0 0 3px rgba(143,18,63,0.18)' : 'none',
                transition: 'all 0.2s',
              }}>
                {isDone ? '✓' : step.num}
              </div>
              <span style={{
                fontSize: '0.625rem',
                marginTop: '0.2rem',
                fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? 'var(--brand-primary)' : isDone ? 'var(--text-primary)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>
            </div>

            {/* Connecting line */}
            {idx < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: '3px',
                margin: '0 0.25rem',
                marginBottom: '1rem',
                background: isDone ? 'var(--success)' : 'var(--border)',
                borderRadius: '2px',
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Order Detail & Stage Transition Modal ─────────────────────────────────────
function OrderFlowModal({
  order,
  onClose,
  onAdvance,
  onReject,
  isUpdating,
}: {
  order: RentalOrder;
  onClose: () => void;
  onAdvance: (order: RentalOrder) => Promise<void>;
  onReject: (order: RentalOrder) => Promise<void>;
  isUpdating: boolean;
}) {
  const nextAction = getNextActionConfig(order);
  const stage = getOrderFlowStage(order);
  const fmtStart = new Date(order.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtEnd = new Date(order.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const days = Math.max(1, Math.ceil((new Date(order.endDate).getTime() - new Date(order.startDate).getTime()) / (1000 * 60 * 60 * 24)));
  const waMsg = generateStageWhatsAppMessage(order);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 65,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: 'rgba(36,21,29,0.65)',
      backdropFilter: 'blur(5px)',
    }}>
      <div className="card" style={{
        maxWidth: '38rem',
        width: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '1.75rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '1.35rem',
                fontWeight: 700,
                color: 'var(--brand-primary)',
                margin: 0,
              }}>
                Order #{order.id} Lifecycle
              </h2>
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: '100px',
                background: order.deliveryOption === 'HOME_DELIVERY' ? 'rgba(194, 24, 91, 0.1)' : 'rgba(169, 101, 18, 0.1)',
                color: order.deliveryOption === 'HOME_DELIVERY' ? 'var(--brand-secondary)' : 'var(--warning)',
                border: '1px solid currentColor',
              }}>
                {order.deliveryOption === 'HOME_DELIVERY' ? '🚚 Home Delivery' : '🏪 Store Pickup'}
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
              Placed on {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Visual Stepper */}
        <div style={{
          padding: '1.25rem',
          background: 'var(--surface-muted)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          marginBottom: '1.5rem',
        }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Current Fulfillment Flow
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <OrderFlowStepper order={order} />
          </div>
        </div>

        {/* Order Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Item details */}
          <div style={{
            padding: '1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rented Outfit</p>
            <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.25rem 0 0.5rem' }}>
              {order.product.name}
            </p>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>📅 {fmtStart} ➔ {fmtEnd} (<strong>{days} day{days !== 1 ? 's' : ''}</strong>)</span>
              <span>🔢 Quantity: <strong>{order.quantity} unit(s)</strong></span>
              <span>💰 Total: <strong style={{ color: 'var(--brand-primary)' }}>₹{Number(order.totalPrice).toFixed(0)}</strong></span>
            </div>
          </div>

          {/* Customer details */}
          <div style={{
            padding: '1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Customer & Destination</p>
            <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.25rem 0 0.25rem' }}>
              {order.user.name}
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0 0 0.35rem' }}>
              📧 {order.user.email}
            </p>
            {order.contactPhone && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0 0 0.35rem' }}>
                📞 Phone: <strong>{order.contactPhone}</strong>
              </p>
            )}
            {order.deliveryAddress && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--surface-muted)', padding: '0.4rem', borderRadius: '4px', margin: 0 }}>
                📍 {order.deliveryAddress}
              </p>
            )}
          </div>
        </div>

        {/* ─── Stage Advancement Action Box ─── */}
        {nextAction ? (
          <div style={{
            padding: '1.25rem',
            background: 'linear-gradient(135deg, rgba(143,18,63,0.04) 0%, rgba(196,154,82,0.06) 100%)',
            border: '1.5px solid var(--brand-primary)',
            borderRadius: '10px',
            marginBottom: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                  Recommended Next Flow Step
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                  {nextAction.nextDescription}
                </p>
              </div>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onAdvance(order)}
                className="btn-primary"
                style={{
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 14px rgba(143,18,63,0.3)',
                }}
              >
                <span>{nextAction.buttonIcon}</span>
                {isUpdating ? 'Advancing Flow…' : nextAction.buttonLabel}
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            padding: '1rem',
            background: 'var(--surface-muted)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            textAlign: 'center',
            marginBottom: '1.25rem',
          }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {stage === 'STEP_4_COMPLETED' ? '🎉 Order is fully completed & costume returned' : '✕ This order is closed/cancelled'}
            </p>
          </div>
        )}

        {/* WhatsApp & Reject Row */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            href={buildWhatsAppUrl(order.contactPhone || '', waMsg)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              minWidth: '180px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.625rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: '#25D366',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-button)',
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(37,211,102,0.3)',
            }}
          >
            <span>💬</span> Send WhatsApp Stage Update
          </a>

          {order.status === 'PENDING' && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onReject(order)}
              style={{
                padding: '0.625rem 1rem',
                fontSize: '0.8125rem',
                color: 'var(--error)',
                background: 'none',
                border: '1px solid var(--error)',
                borderRadius: 'var(--radius-button)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Decline Order
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Flow-Wise OrdersTab Component ─────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStageTab, setActiveStageTab] = useState<'ALL' | 'PENDING' | 'IN_TRANSIT' | 'IN_USE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [search, setSearch] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<RentalOrder | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await rentalsApi.getAllOrders();
      setOrders(res.data || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Stage Advancement Handler
  const handleAdvance = async (order: RentalOrder) => {
    const config = getNextActionConfig(order);
    if (!config) return;

    if (!confirm(`Advance Order #${order.id} to "${config.buttonLabel}"?\n${config.nextDescription}`)) {
      return;
    }

    setIsUpdating(true);
    try {
      if (config.actionType === 'STATUS') {
        await rentalsApi.updateStatus(order.id, config.targetValue);
      } else {
        await rentalsApi.updateDeliveryStatus(order.id, config.targetValue);
      }
      await fetchOrders();
      if (selectedOrder?.id === order.id) {
        // Refresh selected order state
        const updatedOrders = await rentalsApi.getAllOrders();
        const fresh = updatedOrders.data?.find((o: RentalOrder) => o.id === order.id);
        if (fresh) setSelectedOrder(fresh);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Stage update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async (order: RentalOrder) => {
    if (!confirm(`Decline and reject Order #${order.id}?`)) return;
    setIsUpdating(true);
    try {
      await rentalsApi.updateStatus(order.id, 'REJECTED');
      await fetchOrders();
      setSelectedOrder(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to decline order');
    } finally {
      setIsUpdating(false);
    }
  };

  // Pipeline Filter Logic
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          o.id.toString().includes(q) ||
          o.product.name.toLowerCase().includes(q) ||
          o.user.name.toLowerCase().includes(q) ||
          o.user.email.toLowerCase().includes(q) ||
          (o.contactPhone || '').includes(q);
        if (!matches) return false;
      }

      // Delivery mode
      if (deliveryFilter && o.deliveryOption !== deliveryFilter) return false;

      // Pipeline Stage Tab
      const stage = getOrderFlowStage(o);
      if (activeStageTab === 'ALL') return true;
      if (activeStageTab === 'PENDING') return stage === 'STEP_1_PENDING';
      if (activeStageTab === 'IN_TRANSIT') return stage === 'STEP_2_CONFIRMED';
      if (activeStageTab === 'IN_USE') return stage === 'STEP_3_DISPATCHED';
      if (activeStageTab === 'COMPLETED') return stage === 'STEP_4_COMPLETED';
      if (activeStageTab === 'CANCELLED') return stage === 'TERMINATED';
      return true;
    });
  }, [orders, search, deliveryFilter, activeStageTab]);

  // Stage counters
  const counts = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => getOrderFlowStage(o) === 'STEP_1_PENDING').length,
      inTransit: orders.filter((o) => getOrderFlowStage(o) === 'STEP_2_CONFIRMED').length,
      inUse: orders.filter((o) => getOrderFlowStage(o) === 'STEP_3_DISPATCHED').length,
      completed: orders.filter((o) => getOrderFlowStage(o) === 'STEP_4_COMPLETED').length,
      cancelled: orders.filter((o) => getOrderFlowStage(o) === 'TERMINATED').length,
    };
  }, [orders]);

  return (
    <div>
      {/* ─── Stage Pipeline Filter Tabs ─── */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: '0.75rem',
        marginBottom: '1rem',
      }}>
        {[
          { key: 'ALL', label: 'All Orders', count: counts.all, icon: '📋' },
          { key: 'PENDING', label: '1. Needs Approval', count: counts.pending, icon: '⏳', highlight: counts.pending > 0 },
          { key: 'IN_TRANSIT', label: '2. Confirmed & Packing', count: counts.inTransit, icon: '📦' },
          { key: 'IN_USE', label: '3. Dispatched / In-Use', count: counts.inUse, icon: '🚚' },
          { key: 'COMPLETED', label: '4. Returned & Done', count: counts.completed, icon: '✅' },
          { key: 'CANCELLED', label: 'Cancelled', count: counts.cancelled, icon: '✕' },
        ].map((tab) => {
          const isActive = activeStageTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveStageTab(tab.key as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 700 : 500,
                borderRadius: '8px',
                border: isActive ? '1.5px solid var(--brand-primary)' : '1px solid var(--border)',
                background: isActive ? 'var(--surface-muted)' : 'var(--surface)',
                color: isActive ? 'var(--brand-primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '0.15rem 0.45rem',
                borderRadius: '100px',
                background: tab.highlight ? 'var(--brand-primary)' : isActive ? 'var(--brand-gold)' : 'var(--border)',
                color: tab.highlight || isActive ? '#FFFFFF' : 'var(--text-secondary)',
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Search & Quick Fulfillment Bar ─── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        background: 'var(--surface)',
        padding: '0.875rem 1.25rem',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ flex: '1 1 14rem', minWidth: '14rem' }}>
          <input
            type="text"
            placeholder="Search order by customer, outfit, phone, or #ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ fontSize: '0.8125rem' }}
          />
        </div>

        <div>
          <select
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            className="form-input"
            style={{ fontSize: '0.8125rem', width: 'auto', cursor: 'pointer' }}
          >
            <option value="">All Fulfillment Types</option>
            <option value="HOME_DELIVERY">🚚 Home Delivery</option>
            <option value="PICKUP">🏪 Store Pickup</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Showing <strong style={{ color: 'var(--brand-primary)' }}>{filteredOrders.length}</strong> order{filteredOrders.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ─── Orders List ─── */}
      {isLoading ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          <div className="skeleton" style={{ height: '260px', borderRadius: '12px' }} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📋</span>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            No orders match this stage or filter
          </p>
          <p style={{ fontSize: '0.8125rem' }}>Switch tabs or reset your search query.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {filteredOrders.map((order) => {
            const nextAction = getNextActionConfig(order);
            const fmtStart = new Date(order.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            const fmtEnd = new Date(order.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

            return (
              <div
                key={order.id}
                className="card"
                style={{
                  padding: '1.15rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  border: '1px solid var(--border)',
                  transition: 'box-shadow 0.15s',
                }}
              >
                {/* Top Row: Meta info & Stepper */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: 'var(--brand-primary)',
                    }}>
                      Order #{order.id}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '0.175rem 0.5rem',
                      borderRadius: '100px',
                      background: order.deliveryOption === 'HOME_DELIVERY' ? 'rgba(194, 24, 91, 0.08)' : 'rgba(169, 101, 18, 0.08)',
                      color: order.deliveryOption === 'HOME_DELIVERY' ? 'var(--brand-secondary)' : 'var(--warning)',
                      border: '1px solid currentColor',
                    }}>
                      {order.deliveryOption === 'HOME_DELIVERY' ? '🚚 Delivery' : '🏪 Pickup'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      • {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>

                  {/* Visual Stepper */}
                  <div style={{ flex: '1 1 auto', display: 'flex', justifyContent: 'flex-end' }}>
                    <OrderFlowStepper order={order} />
                  </div>
                </div>

                {/* Middle Row: Item & Customer Breakdown */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  alignItems: 'center',
                }}>
                  {/* Item info */}
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-gold)', textTransform: 'uppercase', margin: 0 }}>
                      Costume Item
                    </p>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                      {order.product.name}
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                      📅 {fmtStart} ➔ {fmtEnd} · <strong>Qty: {order.quantity}</strong>
                    </p>
                  </div>

                  {/* Customer info */}
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', margin: 0 }}>
                      Customer
                    </p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                      {order.user.name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                      {order.contactPhone ? `📞 ${order.contactPhone} · ` : ''}{order.user.email}
                    </p>
                  </div>

                  {/* Total & Action Column */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', margin: 0 }}>Order Total</p>
                      <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--brand-primary)', margin: 0 }}>
                        ₹{Number(order.totalPrice).toFixed(0)}
                      </p>
                    </div>

                    {/* Flow Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {nextAction && (
                        <button
                          type="button"
                          onClick={() => handleAdvance(order)}
                          className="btn-primary"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.45rem 0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span>{nextAction.buttonIcon}</span>
                          <span>{nextAction.buttonLabel}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem' }}
                      >
                        Inspect Flow ↗
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-out Order Flow Modal */}
      {selectedOrder && (
        <OrderFlowModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onAdvance={handleAdvance}
          onReject={handleReject}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
}

// ─── Custom Category Manager Modal ─────────────────────────────────────────────
function CategoryManagerModal({
  categories,
  categoryCounts,
  onClose,
  onAddCategory,
}: {
  categories: string[];
  categoryCounts: Record<string, number>;
  onClose: () => void;
  onAddCategory: (categoryName: string) => void;
}) {
  const [newCatName, setNewCatName] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCatName.trim();
    if (!clean) return;
    if (categories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setError('This category already exists');
      return;
    }
    setError('');
    onAddCategory(clean);
    setNewCatName('');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 70,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: 'rgba(36,21,29,0.65)',
      backdropFilter: 'blur(5px)',
    }}>
      <div className="card" style={{
        maxWidth: '32rem',
        width: '100%',
        maxHeight: '85vh',
        overflowY: 'auto',
        padding: '1.75rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--brand-primary)',
              margin: 0,
            }}>
              Custom Categories Manager
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
              Organize costume collections and create custom categories
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Form: Add New Category */}
        <form onSubmit={handleAdd} style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">Create New Category Name</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              type="text"
              required
              placeholder="e.g. Bridal Lehengas, Royal Retro, Anime..."
              value={newCatName}
              onChange={(e) => { setNewCatName(e.target.value); setError(''); }}
              className="form-input"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}>
              + Add
            </button>
          </div>
          {error && <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.35rem' }}>⚠️ {error}</p>}
        </form>

        {/* Existing Categories List */}
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Active Categories ({categories.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {categories.map((c) => {
              const count = categoryCounts[c] || 0;
              return (
                <div
                  key={c}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '100px',
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--border)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c}</span>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: count > 0 ? 'var(--brand-primary)' : 'var(--text-secondary)',
                    background: 'var(--surface)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '100px',
                    border: '1px solid var(--border)',
                  }}>
                    {count} outfit{count !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem 1.25rem' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shopify-Style Product Form Modal ──────────────────────────────────────────
function ProductForm({
  product,
  availableCategories,
  onSave,
  onCancel,
}: {
  product?: Product | null;
  availableCategories: string[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [type, setType] = useState(product?.type || 'RENT');
  const [rentalPrice, setRentalPrice] = useState(product?.rentalPrice ? String(product.rentalPrice) : '');
  const [salePrice, setSalePrice] = useState(product?.salePrice ? String(product.salePrice) : '');
  const [totalStock, setTotalStock] = useState(product?.totalStock ? String(product.totalStock) : '1');

  // Category Selector State
  const [categoryChoice, setCategoryChoice] = useState(() => {
    if (!product?.category) return availableCategories[0] || 'Cosplay';
    if (availableCategories.includes(product.category)) return product.category;
    return 'CUSTOM';
  });
  const [customCategoryInput, setCustomCategoryInput] = useState(() => {
    if (!product?.category) return '';
    if (availableCategories.includes(product.category)) return '';
    return product.category;
  });

  const [image, setImage] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState(product?.imageUrl || '');
  const [isActive, setIsActive] = useState<boolean>(product ? product.isActive : true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const finalCategory = (categoryChoice === 'CUSTOM' ? customCategoryInput : categoryChoice).trim();

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('type', type);
    if (rentalPrice) formData.append('rentalPrice', rentalPrice);
    if (salePrice) formData.append('salePrice', salePrice);
    formData.append('totalStock', totalStock);
    if (finalCategory) formData.append('category', finalCategory);
    formData.append('isActive', String(isActive));
    if (image) formData.append('image', image);
    if (imageUrlInput) formData.append('imageUrl', imageUrlInput);

    try {
      let res;
      if (product) {
        res = await productsApi.update(product.id, formData);
      } else {
        res = await productsApi.create(formData);
      }
      if (!res.success) throw new Error(res.message || 'Failed to save costume outfit');
      onSave();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving costume');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 65,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: 'rgba(36,21,29,0.65)',
      backdropFilter: 'blur(5px)',
    }}>
      <div className="card" style={{
        maxWidth: '34rem',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '1.75rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--brand-primary)',
              margin: 0,
            }}>
              {product ? 'Edit Costume Inventory Item' : '✨ Add New Costume to Inventory'}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>
              Shopify-style product listing & category assignment
            </p>
          </div>
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
            <label className="form-label">Costume Name / Title *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              placeholder="e.g. Royal Victorian Ball Gown with Corset"
            />
          </div>

          <div>
            <label className="form-label">Description & Fit Details</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="form-input"
              placeholder="Fabric details, accessories included, size & fit..."
              style={{ resize: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Listing Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="form-input" style={{ cursor: 'pointer' }}>
                <option value="RENT">RENT ONLY</option>
                <option value="SALE">SALE ONLY</option>
                <option value="BOTH">RENT OR SALE</option>
              </select>
            </div>

            {/* Category Dropdown + Custom Category Option */}
            <div>
              <label className="form-label">Category *</label>
              <select
                value={categoryChoice}
                onChange={(e) => {
                  setCategoryChoice(e.target.value);
                  if (e.target.value !== 'CUSTOM') setCustomCategoryInput('');
                }}
                className="form-input"
                style={{ cursor: 'pointer' }}
              >
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    👗 {c}
                  </option>
                ))}
                <option value="CUSTOM">✍️ + Create Custom Category</option>
              </select>

              {categoryChoice === 'CUSTOM' && (
                <input
                  required
                  placeholder="Type new category name..."
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  className="form-input"
                  style={{ marginTop: '0.35rem', borderColor: 'var(--brand-primary)' }}
                />
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Daily Rental (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={rentalPrice}
                onChange={(e) => setRentalPrice(e.target.value)}
                className="form-input"
                placeholder="₹/day"
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
                placeholder="₹ buy"
              />
            </div>
            <div>
              <label className="form-label">Total Stock *</label>
              <input
                type="number"
                min="0"
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
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="form-input"
              style={{ padding: '0.4rem' }}
            />
          </div>

          <div>
            <label className="form-label">Or Image URL</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Visibility / Active Status Switch */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: isActive ? 'rgba(22,131,74,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${isActive ? 'rgba(22,131,74,0.25)' : 'rgba(239,68,68,0.25)'}`,
            borderRadius: 'var(--radius-input)',
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Catalog Visibility
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {isActive ? 'Costume is Active & visible in customer catalog' : 'Costume is Inactive & hidden from customers'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                borderRadius: '100px',
                border: 'none',
                background: isActive ? 'var(--success)' : '#796570',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span>{isActive ? '● Active' : '○ Inactive'}</span>
              <span style={{ fontSize: '0.6875rem', opacity: 0.85 }}>(Click to switch)</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button type="button" onClick={onCancel} className="btn-secondary" style={{ flex: 1, padding: '0.625rem' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ flex: 1.5, padding: '0.625rem' }}>
              {isSubmitting ? 'Saving…' : product ? 'Update Costume' : 'Create & Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shopify-Style Catalog & Inventory Tab ─────────────────────────────────────
function CatalogTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [typeFilter, setTypeFilter] = useState('All');
  const [activeOnlyFilter, setActiveOnlyFilter] = useState('ALL');

  // Dynamic Categories
  const [categories, setCategories] = useState<string[]>(DEFAULT_STANDARD_CATEGORIES);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await productsApi.getAllAdmin();
      const list: Product[] = res.data || [];
      setProducts(list);

      // Extract all distinct categories from products and combine with defaults
      const dbCats = list.map((p) => p.category?.trim()).filter((c): c is string => Boolean(c));
      const combined = Array.from(new Set([...DEFAULT_STANDARD_CATEGORIES, ...dbCats])).sort();
      setCategories(combined);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Quick inline stock adjuster (+ / -)
  const handleStockAdjust = async (product: Product, delta: number) => {
    const nextStock = Math.max(0, product.totalStock + delta);
    if (nextStock === product.totalStock) return;

    try {
      const fd = new FormData();
      fd.append('totalStock', String(nextStock));
      await productsApi.update(product.id, fd);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, totalStock: nextStock } : p))
      );
    } catch {
      alert('Failed to update stock');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this costume from catalog?')) return;
    try {
      await productsApi.delete(id);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: false } : p)));
    } catch {
      // ignore
    }
  };

  const handleToggleStatus = async (product: Product) => {
    const nextStatus = !product.isActive;
    const actionWord = nextStatus ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${actionWord} "${product.name}"?`)) return;

    try {
      await productsApi.toggleStatus(product.id, nextStatus);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: nextStatus } : p))
      );
    } catch {
      alert(`Failed to ${actionWord} product`);
    }
  };

  const handleAddCustomCategory = (name: string) => {
    if (!categories.includes(name)) {
      setCategories((prev) => [...prev, name].sort());
    }
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    }
    return counts;
  }, [products]);

  // Inventory KPI statistics
  const inventoryStats = useMemo(() => {
    const inStock = products.filter((p) => p.totalStock > 2).length;
    const lowStock = products.filter((p) => p.totalStock > 0 && p.totalStock <= 2).length;
    const outOfStock = products.filter((p) => p.totalStock === 0).length;
    return {
      total: products.length,
      inStock,
      lowStock,
      outOfStock,
      categoriesCount: categories.length,
    };
  }, [products, categories]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          p.name.toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Category
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;

      // Stock
      if (stockFilter === 'IN_STOCK' && p.totalStock <= 2) return false;
      if (stockFilter === 'LOW_STOCK' && (p.totalStock === 0 || p.totalStock > 2)) return false;
      if (stockFilter === 'OUT_OF_STOCK' && p.totalStock > 0) return false;

      // Type
      if (typeFilter !== 'All' && p.type !== typeFilter) return false;

      // Active
      if (activeOnlyFilter === 'ACTIVE' && !p.isActive) return false;
      if (activeOnlyFilter === 'INACTIVE' && p.isActive) return false;

      return true;
    });
  }, [products, search, categoryFilter, stockFilter, typeFilter, activeOnlyFilter]);

  return (
    <div>
      {/* ─── Product Form & Category Manager Modals ─── */}
      {(showForm || editProduct) && (
        <ProductForm
          product={editProduct}
          availableCategories={categories}
          onSave={() => {
            setShowForm(false);
            setEditProduct(null);
            fetchProducts();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditProduct(null);
          }}
        />
      )}

      {showCategoryManager && (
        <CategoryManagerModal
          categories={categories}
          categoryCounts={categoryCounts}
          onClose={() => setShowCategoryManager(false)}
          onAddCategory={handleAddCustomCategory}
        />
      )}

      {/* ─── Shopify-Style Inventory KPI Bar ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '0.875rem',
        marginBottom: '1.5rem',
      }}>
        <div className="card" style={{ padding: '1rem', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Outfits</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.2rem 0 0' }}>
            {inventoryStats.total}
          </p>
        </div>

        <div className="card" style={{ padding: '1rem', border: '1px solid #A8E6C4', background: '#F4FCF7' }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>Healthy Stock (&gt;2)</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', margin: '0.2rem 0 0' }}>
            {inventoryStats.inStock}
          </p>
        </div>

        <div className="card" style={{ padding: '1rem', border: '1px solid #F0D090', background: '#FFFDF5' }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>Low Stock (1-2)</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--warning)', margin: '0.2rem 0 0' }}>
            {inventoryStats.lowStock}
          </p>
        </div>

        <div className="card" style={{ padding: '1rem', border: '1px solid #F5AABA', background: '#FFF7F8' }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--error)', textTransform: 'uppercase' }}>Out of Stock (0)</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--error)', margin: '0.2rem 0 0' }}>
            {inventoryStats.outOfStock}
          </p>
        </div>

        <div className="card" style={{ padding: '1rem', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--brand-gold)', textTransform: 'uppercase' }}>Active Categories</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--brand-primary)', margin: '0.2rem 0 0' }}>
            {inventoryStats.categoriesCount}
          </p>
        </div>
      </div>

      {/* ─── Top Action Bar ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowCategoryManager(true)}
            className="btn-secondary"
            style={{
              padding: '0.5rem 0.85rem',
              fontSize: '0.8125rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>🏷️</span> Manage Custom Categories
          </button>
        </div>

        <button
          id="add-product-btn"
          onClick={() => { setEditProduct(null); setShowForm(true); }}
          className="btn-primary"
          style={{
            padding: '0.55rem 1.15rem',
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 4px 12px rgba(143,18,63,0.25)',
          }}
        >
          <span>✨</span> + Add Costume to Inventory
        </button>
      </div>

      {/* ─── Shopify-Style Multi-Filter Bar ─── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.625rem',
        alignItems: 'center',
        background: 'var(--surface)',
        padding: '0.875rem 1.25rem',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border)',
        marginBottom: '1.25rem',
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 12rem', minWidth: '12rem' }}>
          <input
            type="text"
            placeholder="Search costumes by title, category, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ fontSize: '0.8125rem' }}
          />
        </div>

        {/* Category Filter */}
        <div style={{ minWidth: '140px' }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="form-input"
            style={{ fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            <option value="All">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                👗 {c} {categoryCounts[c] ? `(${categoryCounts[c]})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Stock Status Filter */}
        <div style={{ minWidth: '130px' }}>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="form-input"
            style={{ fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            <option value="ALL">All Stock Levels</option>
            <option value="IN_STOCK">● In Stock (&gt;2)</option>
            <option value="LOW_STOCK">▲ Low Stock (1-2)</option>
            <option value="OUT_OF_STOCK">✕ Out of Stock (0)</option>
          </select>
        </div>

        {/* Type Filter */}
        <div style={{ minWidth: '110px' }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="form-input"
            style={{ fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            <option value="All">All Types</option>
            <option value="RENT">Rent Only</option>
            <option value="SALE">Sale Only</option>
            <option value="BOTH">Rent & Sale</option>
          </select>
        </div>

        {/* Active Filter */}
        <div style={{ minWidth: '110px' }}>
          <select
            value={activeOnlyFilter}
            onChange={(e) => setActiveOnlyFilter(e.target.value)}
            className="form-input"
            style={{ fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {/* Clear Filter */}
        {(search || categoryFilter !== 'All' || stockFilter !== 'ALL' || typeFilter !== 'All' || activeOnlyFilter !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategoryFilter('All');
              setStockFilter('ALL');
              setTypeFilter('All');
              setActiveOnlyFilter('ALL');
            }}
            style={{
              fontSize: '0.75rem',
              color: 'var(--brand-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontWeight: 600,
            }}
          >
            Reset
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          <strong>{filteredProducts.length}</strong> outfit{filteredProducts.length !== 1 ? 's' : ''} listed
        </div>
      </div>

      {/* ─── Shopify-Style Inventory Table ─── */}
      {isLoading ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          <div className="skeleton" style={{ height: '240px', borderRadius: '12px' }} />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>👗</span>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            No costumes found
          </p>
          <p style={{ fontSize: '0.8125rem' }}>Try clearing filters or add a new costume outfit.</p>
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
                  <th style={{ padding: '0.875rem 1rem' }}>Costume Outfit</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Inventory Stock</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Pricing</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isHealthy = p.totalStock > 2;
                  const isLow = p.totalStock > 0 && p.totalStock <= 2;
                  const isOut = p.totalStock === 0;

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-muted)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Product Thumbnail & Title */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            background: 'var(--surface-muted)',
                            border: '1px solid var(--border)',
                            flexShrink: 0,
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {p.imageUrl ? (
                              <Image
                                src={p.imageUrl}
                                alt={p.name}
                                fill
                                style={{ objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{ fontSize: '1.25rem', opacity: 0.6 }}>👗</span>
                            )}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '0.875rem' }}>
                              {p.name}
                            </p>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                              SKU #{p.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category Tag */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <button
                          type="button"
                          onClick={() => setCategoryFilter(p.category || 'All')}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '100px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            background: 'rgba(196,154,82,0.12)',
                            color: 'var(--brand-gold)',
                            border: '1px solid rgba(196,154,82,0.3)',
                          }}>
                            {p.category || 'Unassigned'}
                          </span>
                        </button>
                      </td>

                      {/* Type */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {p.type}
                      </td>

                      {/* Inventory Stock Pill + Inline Adjuster */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '100px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            background: isHealthy ? '#EDFBF4' : isLow ? '#FFF8E7' : '#FFF0F0',
                            color: isHealthy ? '#16834A' : isLow ? '#A96512' : 'var(--error)',
                            border: `1px solid ${isHealthy ? '#A8E6C4' : isLow ? '#F0D090' : '#F5AABA'}`,
                          }}>
                            <span>{isHealthy ? '●' : isLow ? '▲' : '✕'}</span>
                            {p.totalStock} in stock
                          </span>

                          {/* Quick Stepper */}
                          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => handleStockAdjust(p, -1)}
                              disabled={p.totalStock <= 0}
                              title="Decrease stock by 1"
                              style={{
                                width: '22px',
                                height: '22px',
                                background: 'var(--surface)',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStockAdjust(p, 1)}
                              title="Increase stock by 1"
                              style={{
                                width: '22px',
                                height: '22px',
                                background: 'var(--surface)',
                                border: 'none',
                                borderLeft: '1px solid var(--border)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Pricing */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {p.rentalPrice && (
                            <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>
                              ₹{Number(p.rentalPrice).toFixed(0)} <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/day</span>
                            </span>
                          )}
                          {p.salePrice && p.type !== 'RENT' && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                              Sale ₹{Number(p.salePrice).toFixed(0)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Active Status Toggle Badge */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p)}
                          title={`Click to ${p.isActive ? 'Deactivate' : 'Activate'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '0.25rem 0.65rem',
                            borderRadius: '100px',
                            background: p.isActive ? 'rgba(22, 131, 74, 0.12)' : '#FFF0F0',
                            color: p.isActive ? 'var(--success)' : 'var(--error)',
                            border: `1px solid ${p.isActive ? 'rgba(22, 131, 74, 0.35)' : '#F5AABA'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          <span>{p.isActive ? '●' : '○'}</span>
                          <span>{p.isActive ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>

                      {/* Actions: Edit, Deactivate / Activate */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => { setEditProduct(p); setShowForm(true); }}
                            className="btn-secondary"
                            style={{ fontSize: '0.6875rem', padding: '0.3rem 0.6rem' }}
                          >
                            Edit
                          </button>
                          {p.isActive ? (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(p)}
                              title="Deactivate costume from public catalog"
                              style={{
                                fontSize: '0.6875rem',
                                padding: '0.3rem 0.6rem',
                                background: '#FFF7F8',
                                border: '1px solid #F5AABA',
                                color: 'var(--error)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(p)}
                              title="Re-activate costume to show in catalog"
                              style={{
                                fontSize: '0.6875rem',
                                padding: '0.3rem 0.6rem',
                                background: '#EDFBF4',
                                border: '1px solid #A8E6C4',
                                color: '#16834A',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 700,
                              }}
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory'>('orders');

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
            width: '44px',
            height: '44px',
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
              Shopify-Style Boutique Operations
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>
              DGS&apos;s Creation · Flow-wise order pipeline & costume inventory administration
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <StatCard label="Costumes in Catalog" value={stats.totalProducts} icon="👗" />
          <StatCard label="Total Orders" value={stats.totalOrders} icon="📋" />
          <StatCard label="Action Needed" value={stats.pendingOrders} sub="Awaiting flow advance" icon="⏳" />
          <StatCard label="Dispatches Pending" value={stats.pendingDeliveries ?? 0} sub="Needs delivery" icon="🚚" />
          <StatCard label="Registered Clients" value={stats.totalUsers} icon="👥" />
          <StatCard label="Total Revenue" value={`₹${Number(stats.totalRevenue).toFixed(0)}`} sub="Approved orders" gold icon="💎" />
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: '1.75rem',
        gap: '0.5rem',
      }}>
        {[
          { id: 'orders', label: '🔄 Flow-Wise Order Pipeline' },
          { id: 'inventory', label: '👗 Shopify Costume Inventory' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
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
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'orders' ? <OrdersTab /> : <CatalogTab />}
    </div>
  );
}

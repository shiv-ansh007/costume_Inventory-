'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { rentalsApi, productsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

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

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  APPROVED: 'bg-green-50 text-green-700 border border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border border-red-200',
  RETURNED: 'bg-blue-50 text-blue-700 border border-blue-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border border-gray-200',
};

const DELIVERY_STATUS_STYLES: Record<string, { label: string; badge: string }> = {
  PENDING_APPROVAL: { label: 'Awaiting Approval', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  DELIVERY_APPROVED: { label: 'Delivery Approved', badge: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', badge: 'bg-purple-100 text-purple-800 border-purple-300' },
  DELIVERED: { label: 'Delivered', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
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
`🎭 *COSTUME RENTAL STORE*
*Order Approval Confirmation*

Hello *${order.user.name}*,
Great news! Your costume rental request *#${order.id}* has been *APPROVED*! ✅

📋 *Order Summary:*
• *Item:* ${order.product.name}
• *Quantity:* ${order.quantity} unit(s)
• *Rental Dates:* ${fmtStart} ➡️ ${fmtEnd}
• *Delivery Method:* ${isHomeDel ? '🚚 Home Delivery (+₹50)' : '🏪 Store Pickup'}
${order.deliveryAddress ? `• *Delivery Address:* ${order.deliveryAddress}\n` : ''}• *Total Price:* ₹${Number(order.totalPrice).toFixed(0)}

${isHomeDel 
  ? '🚚 *Home Delivery:* Your order is approved and our team is preparing it for doorstep dispatch.' 
  : `🏪 *Store Pickup:* Your costume is reserved and ready for pickup at our store on ${fmtStart}.`}

Thank you for choosing us! Please reply right here on WhatsApp if you have any questions. 💬`
    );
  }

  if (templateType === 'OUT_FOR_DELIVERY') {
    return (
`🚚 *COSTUME DISPATCH UPDATE*

Hello *${order.user.name}*,
Your costume rental order *#${order.id}* (*${order.product.name}*) is now *OUT FOR DELIVERY*! 📦

📍 *Delivery Address:* ${order.deliveryAddress || 'Address on file'}
📞 *Contact Phone:* ${order.contactPhone || 'N/A'}
💰 *Total Amount:* ₹${Number(order.totalPrice).toFixed(0)}

Our delivery partner will arrive shortly. Please keep your phone available! 💬`
    );
  }

  if (templateType === 'DELIVERED') {
    return (
`🎉 *COSTUME DELIVERED*

Hello *${order.user.name}*,
Your costume rental order *#${order.id}* (*${order.product.name}*) has been successfully *DELIVERED*! 📦

Please check your costume and accessories.
Rental return date: *${fmtEnd}*.

We hope you have a fantastic event! 🎭`
    );
  }

  if (templateType === 'RETURN_REMINDER') {
    return (
`⏰ *COSTUME RETURN REMINDER*

Hello *${order.user.name}*,
Friendly reminder that your costume rental for *"${order.product.name}"* (Order *#${order.id}*) is scheduled for return on *${fmtEnd}*.

Please ensure the costume and accessories are packed and ready for return. Thank you! 🎭`
    );
  }

  return '';
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

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

      // 📱 Automatically trigger customizable WhatsApp redirect modal when approving!
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

      // If marked Out for Delivery or Delivered, open WhatsApp prompt with appropriate template
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
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Rental Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="">All Rental Statuses</option>
            {['PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Delivery Filter</label>
          <select
            id="delivery-filter"
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 font-medium text-gray-800"
          >
            <option value="">All Delivery Modes</option>
            <option value="NEEDS_APPROVAL">⏳ Needs Delivery Approval</option>
            <option value="HOME_DELIVERY">🚚 Home Delivery (All)</option>
            <option value="PICKUP">🏪 Store Pickup</option>
          </select>
        </div>

        <div className="ml-auto self-end text-sm text-gray-500">
          Showing <span className="font-semibold text-gray-900">{filteredOrders.length}</span> of {orders.length} order(s)
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading orders...</p>
      ) : filteredOrders.length === 0 ? (
        <p className="text-gray-500 text-sm py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
          No orders match the selected filters.
        </p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="px-3.5 py-3">Order</th>
                <th className="px-3.5 py-3">Customer</th>
                <th className="px-3.5 py-3">Product & Dates</th>
                <th className="px-3.5 py-3">Delivery Method & Details</th>
                <th className="px-3.5 py-3">Total</th>
                <th className="px-3.5 py-3">Rental Order</th>
                <th className="px-3.5 py-3">Delivery Approval & Flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredOrders.map((order) => {
                const isHomeDel = order.deliveryOption === 'HOME_DELIVERY';
                const delInfo = order.deliveryStatus ? DELIVERY_STATUS_STYLES[order.deliveryStatus] : null;

                return (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Order ID */}
                    <td className="px-3.5 py-3 text-gray-400 text-xs font-mono font-medium">
                      #{order.id}
                      <div className="text-[10px] text-gray-400">{fmt(order.createdAt)}</div>
                    </td>

                    {/* Customer */}
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-gray-900">{order.user.name}</div>
                      <div className="text-xs text-gray-500">{order.user.email}</div>
                    </td>

                    {/* Product & Dates */}
                    <td className="px-3.5 py-3">
                      <div className="font-medium text-gray-800">{order.product.name}</div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {fmt(order.startDate)} → {fmt(order.endDate)}
                      </div>
                      <div className="text-[11px] text-gray-400">Qty: {order.quantity}</div>
                      {order.notes && (
                        <div className="text-[11px] text-gray-500 italic max-w-xs truncate" title={order.notes}>
                          "{order.notes}"
                        </div>
                      )}
                    </td>

                    {/* Delivery Method & Details */}
                    <td className="px-3.5 py-3 max-w-xs">
                      {isHomeDel ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            <span>🚚</span> Home Delivery (+₹50)
                          </span>
                          {order.deliveryAddress && (
                            <div className="text-xs text-gray-700 font-medium leading-snug">
                              📍 {order.deliveryAddress}
                            </div>
                          )}
                          {order.contactPhone && (
                            <div className="text-xs text-gray-500">
                              📞 {order.contactPhone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                          <span>🏪</span> Store Pickup
                        </span>
                      )}
                    </td>

                    {/* Total Price */}
                    <td className="px-3.5 py-3 whitespace-nowrap font-bold text-gray-900">
                      ₹{Number(order.totalPrice).toFixed(0)}
                    </td>

                    {/* Rental Order Status & Action */}
                    <td className="px-3.5 py-3">
                      <div className="space-y-1.5">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLES[order.status] || ''}`}>
                          {order.status}
                        </span>
                        {order.status === 'PENDING' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => updateStatus(order.id, 'APPROVED')}
                              disabled={updatingId === order.id}
                              className="text-xs px-2 py-1 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateStatus(order.id, 'REJECTED')}
                              disabled={updatingId === order.id}
                              className="text-xs px-2 py-1 bg-rose-600 text-white rounded font-medium hover:bg-rose-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {order.status === 'APPROVED' && (
                          <button
                            onClick={() => updateStatus(order.id, 'RETURNED')}
                            disabled={updatingId === order.id}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
                          >
                            Mark Returned
                          </button>
                        )}
                        <div>
                          <button
                            type="button"
                            onClick={() => handleOpenWhatsApp(order, 'APPROVAL')}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded transition shadow-2xs"
                            title="Open customizable WhatsApp notification"
                          >
                            <span>💬</span> WhatsApp
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Delivery Approval & Flow */}
                    <td className="px-3.5 py-3 min-w-[210px]">
                      {isHomeDel ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            {delInfo && (
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${delInfo.badge}`}>
                                {delInfo.label}
                              </span>
                            )}
                          </div>

                          {/* Quick delivery approval buttons */}
                          <div className="flex flex-wrap gap-1">
                            {order.deliveryStatus === 'PENDING_APPROVAL' && (
                              <button
                                onClick={() => updateDeliveryStatus(order.id, 'DELIVERY_APPROVED')}
                                disabled={updatingDeliveryId === order.id}
                                className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                              >
                                <span>✓</span> Approve Delivery
                              </button>
                            )}
                            {order.deliveryStatus === 'DELIVERY_APPROVED' && (
                              <button
                                onClick={() => updateDeliveryStatus(order.id, 'OUT_FOR_DELIVERY')}
                                disabled={updatingDeliveryId === order.id}
                                className="text-xs px-2.5 py-1 bg-purple-600 text-white rounded font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                              >
                                <span>🚚</span> Dispatch / Out for Delivery
                              </button>
                            )}
                            {order.deliveryStatus === 'OUT_FOR_DELIVERY' && (
                              <button
                                onClick={() => updateDeliveryStatus(order.id, 'DELIVERED')}
                                disabled={updatingDeliveryId === order.id}
                                className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                              >
                                <span>📦</span> Mark Delivered
                              </button>
                            )}
                          </div>

                          {/* Dropdown for manual override */}
                          <div className="flex items-center gap-1 pt-0.5">
                            <span className="text-[10px] text-gray-400">Set:</span>
                            <select
                              value={order.deliveryStatus || 'PENDING_APPROVAL'}
                              onChange={(e) => updateDeliveryStatus(order.id, e.target.value)}
                              disabled={updatingDeliveryId === order.id}
                              className="text-[11px] border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-700 focus:outline-none"
                            >
                              <option value="PENDING_APPROVAL">Pending Approval</option>
                              <option value="DELIVERY_APPROVED">Approved</option>
                              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                              <option value="DELIVERED">Delivered</option>
                            </select>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Self pickup at store</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── WhatsApp Customization & Redirect Modal ─── */}
      {waOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="bg-emerald-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">💬</span>
                <div>
                  <h3 className="text-base font-bold leading-tight">Send WhatsApp Message</h3>
                  <p className="text-xs text-emerald-100">Order #{waOrder.id} · {waOrder.user.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaOrder(null)}
                className="text-white/80 hover:text-white text-xl font-bold p-1 leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              {/* Phone Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Recipient WhatsApp / Mobile Number
                </label>
                <input
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="e.g. 9876543210 (with or without 91)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                {!waPhone && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    ℹ️ Customer did not provide a phone number on booking. Enter their mobile number above to open their chat directly, or open WhatsApp to choose from your chats.
                  </p>
                )}
              </div>

              {/* Template Switcher */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Message Template
                </label>
                <div className="flex flex-wrap gap-1.5">
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
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${
                        waTemplate === t.key
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Preview & Editor */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Customizable Message Text
                  </label>
                  <span className="text-[11px] text-gray-400">Pre-filled with order details</span>
                </div>
                <textarea
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  rows={8}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono leading-relaxed resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const url = buildWhatsAppUrl(waPhone, waMessage);
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🚀</span> Open WhatsApp Web / App
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(waMessage);
                    setWaCopied(true);
                    setTimeout(() => setWaCopied(false), 2000);
                  }}
                  className="py-2.5 px-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-xs border border-gray-300 transition shrink-0 cursor-pointer"
                >
                  {waCopied ? '✓ Copied!' : '📋 Copy Text'}
                </button>

                <button
                  type="button"
                  onClick={() => setWaOrder(null)}
                  className="py-2.5 px-3 text-gray-500 hover:text-gray-800 text-xs font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-semibold text-gray-900">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none">
                <option value="RENT">RENT</option>
                <option value="SALE">SALE</option>
                <option value="BOTH">BOTH</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Halloween"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rental Price (₹/day)</label>
              <input type="number" step="0.01" min="0" value={rentalPrice} onChange={(e) => setRentalPrice(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sale Price (₹)</label>
              <input type="number" step="0.01" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Stock</label>
              <input type="number" min="1" required value={totalStock} onChange={(e) => setTotalStock(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Image Upload (via Cloudinary)</label>
            <input
              id="product-image-input"
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Or Direct Image URL</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/... or any image link"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500"
            />
            {product?.imageUrl && !image && (
              <p className="text-xs text-gray-400 mt-1">Current image: {product.imageUrl.slice(0, 45)}...</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel}
              className="flex-1 border border-gray-300 rounded py-2 text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 bg-gray-900 text-white rounded py-2 text-sm hover:bg-gray-700 transition-colors disabled:opacity-50">
              {isSubmitting ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
    if (!confirm('Deactivate this product?')) return;
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

      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">{products.length} product(s) total</span>
        <button
          id="add-product-btn"
          onClick={() => { setEditProduct(null); setShowForm(true); }}
          className="px-3 py-1.5 bg-gray-900 text-white rounded text-sm hover:bg-gray-700 transition-colors"
        >
          + Add Product
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading products...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Rental ₹</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.type}</td>
                  <td className="px-4 py-3 text-gray-600">{p.category || '—'}</td>
                  <td className="px-4 py-3">{p.rentalPrice ? `₹${Number(p.rentalPrice).toFixed(0)}` : '—'}</td>
                  <td className="px-4 py-3">{p.totalStock}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${p.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditProduct(p); setShowForm(true); }}
                        className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      {p.isActive && (
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
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
      )}
    </div>
  );
}

// ─── Main Admin Page ────────────────────────────────────────────────────────────
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <StatCard label="Products" value={stats.totalProducts} />
          <StatCard label="Total Orders" value={stats.totalOrders} />
          <StatCard label="Pending Orders" value={stats.pendingOrders} sub="Awaiting review" />
          <StatCard label="Delivery Approvals" value={stats.pendingDeliveries ?? 0} sub="Needs dispatch" />
          <StatCard label="Clients" value={stats.totalUsers} />
          <StatCard label="Revenue" value={`₹${Number(stats.totalRevenue).toFixed(0)}`} sub="Approved orders" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-0">
        {(['orders', 'catalog'] as const).map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              activeTab === tab
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab === 'orders' ? 'Rental Orders' : 'Catalog'}
          </button>
        ))}
      </div>

      {activeTab === 'orders' ? <OrdersTab /> : <CatalogTab />}
    </div>
  );
}

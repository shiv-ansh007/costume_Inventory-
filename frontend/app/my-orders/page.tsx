'use client';

import { useState, useEffect } from 'react';
import { rentalsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

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

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  RETURNED: 'bg-blue-50 text-blue-700 border-blue-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
};

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; style: string; icon: string }> = {
  PENDING_APPROVAL: { label: 'Awaiting Delivery Approval', style: 'bg-amber-50 text-amber-800 border-amber-200', icon: '⏳' },
  DELIVERY_APPROVED: { label: 'Delivery Approved', style: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: '✅' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', style: 'bg-purple-50 text-purple-700 border-purple-200', icon: '🚚' },
  DELIVERED: { label: 'Delivered', style: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '🎉' },
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
      .catch(() => setError('Failed to load orders'))
      .finally(() => setIsLoading(false));
  }, [user]);

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this rental request?')) return;
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

  if (isLoading) return <div className="text-center py-16 text-gray-500">Loading orders...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Rental Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Track your costume bookings and delivery status</p>
        </div>
        <a href="/catalog" className="text-sm px-3.5 py-1.5 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition">
          + Book Another
        </a>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {orders.length === 0 ? (
        <div className="text-center py-16 border border-gray-200 rounded-lg bg-white">
          <p className="text-gray-500 mb-4">You have no rental orders yet.</p>
          <a href="/catalog" className="text-sm text-gray-900 font-medium underline">Browse Catalog</a>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isHomeDelivery = order.deliveryOption === 'HOME_DELIVERY';
            const delConfig = order.deliveryStatus ? DELIVERY_STATUS_CONFIG[order.deliveryStatus] : null;

            return (
              <div key={order.id} className="border border-gray-200 rounded-xl bg-white p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[order.status]}`}>
                        Rental: {order.status}
                      </span>
                      {isHomeDelivery ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <span>🚚</span> Home Delivery
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1">
                          <span>🏪</span> Store Pickup
                        </span>
                      )}
                      <span className="text-xs text-gray-400">Order #{order.id}</span>
                    </div>

                    <h2 className="text-base font-semibold text-gray-900">{order.product.name}</h2>
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium text-gray-800">Duration:</span> {fmt(order.startDate)} → {fmt(order.endDate)} · <span className="font-medium text-gray-800">Qty:</span> {order.quantity}
                    </p>

                    {/* Delivery Details Card if Home Delivery */}
                    {isHomeDelivery && (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700 flex items-center gap-1">
                            <span>📦</span> Delivery Status:
                          </span>
                          {delConfig && (
                            <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold flex items-center gap-1 ${delConfig.style}`}>
                              <span>{delConfig.icon}</span> {delConfig.label}
                            </span>
                          )}
                        </div>

                        {order.deliveryAddress && (
                          <p className="text-slate-600 text-[11px]">
                            <span className="font-medium text-slate-700">Address:</span> {order.deliveryAddress}
                          </p>
                        )}
                        {order.contactPhone && (
                          <p className="text-slate-600 text-[11px]">
                            <span className="font-medium text-slate-700">Phone:</span> {order.contactPhone}
                          </p>
                        )}
                      </div>
                    )}

                    {order.notes && (
                      <p className="text-xs text-gray-500 mt-2 italic bg-gray-50 p-2 rounded">
                        Note: "{order.notes}"
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">₹{Number(order.totalPrice).toFixed(0)}</p>
                    {isHomeDelivery && (
                      <p className="text-[11px] text-gray-500 font-medium">Incl. ₹50 delivery</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(order.createdAt)}</p>
                    {order.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        className="mt-3 block ml-auto text-xs text-red-600 hover:text-red-800 font-medium underline disabled:opacity-50"
                      >
                        {cancellingId === order.id ? 'Cancelling...' : 'Cancel Request'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

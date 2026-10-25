'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { productsApi, rentalsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface Product {
  id: number;
  name: string;
  description?: string;
  type: 'RENT' | 'SALE' | 'BOTH';
  rentalPrice?: number | null;
  salePrice?: number | null;
  totalStock: number;
  imageUrl?: string | null;
  category?: string | null;
}

interface Availability {
  availableQuantity: number;
  isAvailable: boolean;
  rentalDays: number;
  priceEstimate: number | null;
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const isSubmittingRef = useRef(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const [deliveryOption, setDeliveryOption] = useState<'PICKUP' | 'HOME_DELIVERY'>('PICKUP');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  useEffect(() => {
    productsApi
      .getById(Number(id))
      .then((res) => setProduct(res.data))
      .catch(() => setError('Product not found'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const checkAvailability = async () => {
    if (!startDate || !endDate) return;
    setIsChecking(true);
    setAvailability(null);
    try {
      const res = await productsApi.checkAvailability(Number(id), startDate, endDate);
      setAvailability(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error checking availability');
    } finally {
      setIsChecking(false);
    }
  };

  const submitRequest = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (isSubmittingRef.current || isSubmitting || orderSuccess) {
      return;
    }

    if (deliveryOption === 'HOME_DELIVERY') {
      if (!deliveryAddress.trim()) {
        setError('Please enter your full delivery address.');
        return;
      }
      if (!contactPhone.trim()) {
        setError('Please enter a contact phone number for the delivery team.');
        return;
      }
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await rentalsApi.request({
        productId: Number(id),
        startDate,
        endDate,
        quantity,
        notes: notes || undefined,
        deliveryOption,
        deliveryAddress: deliveryOption === 'HOME_DELIVERY' ? deliveryAddress : undefined,
        contactPhone: contactPhone ? contactPhone.trim() : undefined,
      });
      setOrderSuccess(true);
      setSuccess(`Rental order placed! ${deliveryOption === 'HOME_DELIVERY' ? 'Home Delivery requested to ' + deliveryAddress : 'Store pickup chosen'}. Redirecting to your orders...`);
      setTimeout(() => {
        router.push('/my-orders');
      }, 1500);
    } catch (e: unknown) {
      isSubmittingRef.current = false;
      setError(e instanceof Error ? e.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-96 bg-gray-200 rounded-lg" />
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-20 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className="text-center py-16 text-gray-500">Product not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-800 mb-6 flex items-center gap-1">
        ← Back
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="relative h-80 md:h-96 bg-gray-100 rounded-lg overflow-hidden">
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-5xl">🎭</div>
          )}
        </div>

        {/* Details */}
        <div>
          <p className="text-xs text-gray-400 uppercase mb-1">{product.category || 'Uncategorized'}</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{product.name}</h1>

          {product.description && (
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">{product.description}</p>
          )}

          <div className="border border-gray-200 rounded-lg p-4 mb-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-medium">{product.type}</span>
            </div>
            {product.rentalPrice && (
              <div className="flex justify-between">
                <span className="text-gray-500">Rental Price</span>
                <span className="font-medium">₹{Number(product.rentalPrice).toFixed(0)} / day</span>
              </div>
            )}
            {product.salePrice && (
              <div className="flex justify-between">
                <span className="text-gray-500">Sale Price</span>
                <span className="font-medium">₹{Number(product.salePrice).toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Available Stock</span>
              <span className={`font-semibold ${product.totalStock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {product.totalStock > 0 ? `${product.totalStock} units available` : 'Out of stock'}
              </span>
            </div>
          </div>

          {/* Rental Form */}
          {(product.type === 'RENT' || product.type === 'BOTH') && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Request Rental</h2>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input
                    id="start-date-input"
                    type="date"
                    min={today}
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setAvailability(null); }}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Date</label>
                  <input
                    id="end-date-input"
                    type="date"
                    min={tomorrow}
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setAvailability(null); }}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-500"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                <input
                  id="quantity-input"
                  type="number"
                  min={1}
                  max={product.totalStock}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Delivery Preference</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryOption('PICKUP')}
                    className={`flex flex-col items-start p-3 border rounded-lg text-left transition-all ${
                      deliveryOption === 'PICKUP'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <span>🏪</span> Store Pickup
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">FREE</span>
                    </div>
                    <span className="text-xs text-gray-500">Pick up in store</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryOption('HOME_DELIVERY')}
                    className={`flex flex-col items-start p-3 border rounded-lg text-left transition-all ${
                      deliveryOption === 'HOME_DELIVERY'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <span>🚚</span> Home Delivery
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">+₹50</span>
                    </div>
                    <span className="text-xs text-gray-500">Doorstep delivery</span>
                  </button>
                </div>
              </div>

              {deliveryOption === 'HOME_DELIVERY' ? (
                <div className="mb-4 p-3.5 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Delivery Address <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="delivery-address-input"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows={2}
                      placeholder="Flat / House No., Street, Area, City & PIN code..."
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      WhatsApp / Contact Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="contact-phone-input"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="e.g. 9876543210 (for WhatsApp order approval & updates)"
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <p className="text-[11px] text-amber-700 flex items-center gap-1">
                    <span>ℹ️</span> Admin reviews & approves delivery before dispatch.
                  </p>
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    WhatsApp / Mobile Number (optional)
                  </label>
                  <input
                    id="contact-phone-input"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. 9876543210 (receive approval & pickup update on WhatsApp)"
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Admin can send approval & pickup details directly to your WhatsApp.
                  </p>
                </div>
              )}

              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                <textarea
                  id="notes-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any special requirements..."
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-500 resize-none"
                />
              </div>

              <button
                id="check-availability-btn"
                onClick={checkAvailability}
                disabled={isChecking}
                className="w-full mb-3 px-4 py-2 border border-gray-900 text-gray-900 rounded text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isChecking ? 'Checking...' : 'Check Availability'}
              </button>

              {availability && (
                <div className={`mb-3 p-3 rounded text-sm ${availability.isAvailable ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  {availability.isAvailable ? (
                    <div className="space-y-1">
                      <p className="text-green-700 font-medium">✓ Available — {availability.availableQuantity} unit(s) free</p>
                      <div className="text-xs text-gray-600 pt-1 border-t border-green-200/60 mt-1.5 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Rental ({availability.rentalDays} day{availability.rentalDays !== 1 ? 's' : ''}):</span>
                          <span>₹{(availability.priceEstimate || 0).toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Delivery Fee ({deliveryOption === 'HOME_DELIVERY' ? 'Home' : 'Pickup'}):</span>
                          <span>{deliveryOption === 'HOME_DELIVERY' ? '₹50' : '₹0'}</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-green-200">
                          <span>Total Amount:</span>
                          <span className="text-indigo-700">₹{((availability.priceEstimate || 0) + (deliveryOption === 'HOME_DELIVERY' ? 50 : 0)).toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-700 font-medium">✗ Not available for these dates</p>
                  )}
                </div>
              )}

              {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
              {success && <p className="text-green-600 text-xs mb-3">{success}</p>}

              <button
                id="submit-rental-btn"
                onClick={submitRequest}
                disabled={isSubmitting || orderSuccess || product.totalStock <= 0 || (availability !== null && !availability.isAvailable)}
                className="w-full px-4 py-2.5 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Submitting Order...</span>
                  </>
                ) : orderSuccess ? (
                  '✓ Order Placed! Redirecting...'
                ) : product.totalStock <= 0 ? (
                  'Out of Stock'
                ) : user ? (
                  `Submit Rental Request · ₹${(
                    (availability?.priceEstimate || (product.rentalPrice ? Number(product.rentalPrice) : 0)) +
                    (deliveryOption === 'HOME_DELIVERY' ? 50 : 0)
                  ).toFixed(0)}`
                ) : (
                  'Login to Request'
                )}
              </button>

              {orderSuccess && (
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/my-orders')}
                    className="text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    Go to My Orders now →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

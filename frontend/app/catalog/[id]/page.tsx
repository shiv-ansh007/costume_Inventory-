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
      setSuccess(`Rental request submitted successfully! ${deliveryOption === 'HOME_DELIVERY' ? 'Home Delivery booked' : 'Store pickup chosen'}. Redirecting to your orders...`);
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
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '2.5rem 1rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2.5rem',
        }}>
          <div className="skeleton" style={{ height: '420px', borderRadius: 'var(--radius-card)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="skeleton" style={{ height: '28px', width: '40%', borderRadius: '6px' }} />
            <div className="skeleton" style={{ height: '36px', width: '80%', borderRadius: '6px' }} />
            <div className="skeleton" style={{ height: '80px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ height: '240px', borderRadius: 'var(--radius-card)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--text-secondary)' }}>
        <p style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Product not found.</p>
        <button onClick={() => router.push('/catalog')} className="btn-secondary">
          ← Return to Catalog
        </button>
      </div>
    );
  }

  const estimatedTotal = (
    (availability?.priceEstimate || (product.rentalPrice ? Number(product.rentalPrice) : 0)) +
    (deliveryOption === 'HOME_DELIVERY' ? 50 : 0)
  );

  return (
    <div style={{ maxWidth: '74rem', margin: '0 auto', padding: '1.5rem 1rem 3.5rem' }}>
      {/* Breadcrumb / Back button */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          marginBottom: '1.5rem',
          padding: '0.25rem 0',
          fontWeight: 500,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--brand-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        ← Back to Catalog
      </button>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2.5rem',
        alignItems: 'start',
      }}>
        {/* Left Column: Product Visual Showcase */}
        <div>
          <div style={{
            position: 'relative',
            height: '460px',
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
            backgroundColor: 'var(--surface-muted)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}>
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                background: 'var(--gradient-soft)',
                color: 'var(--brand-primary)',
              }}>
                <span style={{ fontSize: '4.5rem', opacity: 0.8 }}>👗</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.5rem', color: 'var(--brand-primary)' }}>
                  DGS&apos;s Creation Collection
                </span>
              </div>
            )}

            {/* Type badge overlay */}
            <div style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              background: 'rgba(36, 21, 29, 0.85)',
              backdropFilter: 'blur(8px)',
              color: 'var(--brand-ivory)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px',
              border: '1px solid rgba(196,154,82,0.4)',
            }}>
              {product.type === 'RENT' ? '✨ RENTAL ONLY' : product.type === 'SALE' ? '🛍️ PURCHASE ONLY' : '✨ RENT OR BUY'}
            </div>
          </div>

          {/* Boutique Trust Badges */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            marginTop: '1.25rem',
          }}>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.75rem 0.5rem',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '1.25rem', display: 'block' }}>🧼</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>
                Dry Cleaned
              </span>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Sanitized & Fresh</span>
            </div>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.75rem 0.5rem',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '1.25rem', display: 'block' }}>✨</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>
                Premium Fabric
              </span>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>DGS&apos;s Boutique Quality</span>
            </div>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.75rem 0.5rem',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '1.25rem', display: 'block' }}>🚚</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginTop: '0.25rem' }}>
                Express Delivery
              </span>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Doorstep or Pickup</span>
            </div>
          </div>
        </div>

        {/* Right Column: Costume Information & Rental Booking Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--brand-gold)',
            }}>
              {product.category || 'Costume Rental'}
            </span>
            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '1.875rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0.35rem 0 0.75rem',
              lineHeight: 1.25,
            }}>
              {product.name}
            </h1>

            {product.description && (
              <p style={{
                fontSize: '0.9375rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: '1rem',
              }}>
                {product.description}
              </p>
            )}

            {/* Pricing Snapshot Card */}
            <div style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--brand-blush)',
              borderRadius: 'var(--radius-card)',
              padding: '1rem 1.25rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rental Rate
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
                  <span style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: 'var(--brand-primary)',
                  }}>
                    ₹{product.rentalPrice ? Number(product.rentalPrice).toFixed(0) : '—'}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>/ day</span>
                </div>
              </div>

              {product.salePrice && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Purchase Price
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    ₹{Number(product.salePrice).toFixed(0)}
                  </div>
                </div>
              )}

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Stock Status
                </span>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: product.totalStock > 0 ? 'var(--success)' : 'var(--error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}>
                  <span>{product.totalStock > 0 ? '●' : '✕'}</span>
                  <span>{product.totalStock > 0 ? `${product.totalStock} Available` : 'Out of Stock'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Flow Card */}
          {(product.type === 'RENT' || product.type === 'BOTH') && (
            <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h2 style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}>
                  Reserve This Outfit
                </h2>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--brand-gold)',
                  fontWeight: 600,
                  background: 'rgba(196,154,82,0.1)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                }}>
                  Flexible Booking
                </span>
              </div>

              {/* Date Pickers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.875rem',
                marginBottom: '1rem',
              }}>
                <div>
                  <label htmlFor="start-date-input" className="form-label">Rental Start Date</label>
                  <input
                    id="start-date-input"
                    type="date"
                    min={today}
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setAvailability(null); }}
                    className="form-input"
                  />
                </div>
                <div>
                  <label htmlFor="end-date-input" className="form-label">Return Date</label>
                  <input
                    id="end-date-input"
                    type="date"
                    min={tomorrow}
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setAvailability(null); }}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Quantity */}
              <div style={{ marginBottom: '1.125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label htmlFor="quantity-input" className="form-label" style={{ margin: 0 }}>Quantity</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Max: {product.totalStock}</span>
                </div>
                <input
                  id="quantity-input"
                  type="number"
                  min={1}
                  max={product.totalStock}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(product.totalStock, Number(e.target.value))))}
                  className="form-input"
                />
              </div>

              {/* Delivery / Store Pickup Selection */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>Fulfillment Method</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setDeliveryOption('PICKUP')}
                    style={{
                      padding: '0.875rem 0.75rem',
                      borderRadius: '8px',
                      border: deliveryOption === 'PICKUP' ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                      background: deliveryOption === 'PICKUP' ? 'var(--surface-muted)' : 'var(--surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        🏪 Store Pickup
                      </span>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: 'var(--success)',
                        background: 'rgba(22,131,74,0.1)',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                      }}>
                        FREE
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Collect at our boutique</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryOption('HOME_DELIVERY')}
                    style={{
                      padding: '0.875rem 0.75rem',
                      borderRadius: '8px',
                      border: deliveryOption === 'HOME_DELIVERY' ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                      background: deliveryOption === 'HOME_DELIVERY' ? 'var(--surface-muted)' : 'var(--surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        🚚 Home Delivery
                      </span>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: 'var(--brand-primary)',
                        background: 'rgba(143,18,63,0.1)',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                      }}>
                        +₹50
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Direct to your doorstep</span>
                  </button>
                </div>
              </div>

              {/* Delivery Details Fields */}
              {deliveryOption === 'HOME_DELIVERY' ? (
                <div style={{
                  padding: '1rem',
                  background: 'var(--brand-ivory)',
                  border: '1px solid var(--brand-blush)',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}>
                  <div>
                    <label htmlFor="delivery-address-input" className="form-label">
                      Delivery Address <span style={{ color: 'var(--error)' }}>*</span>
                    </label>
                    <textarea
                      id="delivery-address-input"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows={2}
                      placeholder="House / Flat No., Street, Landmark, City & PIN..."
                      className="form-input"
                      style={{ resize: 'none' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-phone-input" className="form-label">
                      WhatsApp / Mobile Contact <span style={{ color: 'var(--error)' }}>*</span>
                    </label>
                    <input
                      id="contact-phone-input"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="e.g. 9876543210 (for dispatch & WhatsApp updates)"
                      className="form-input"
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--warning)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>ℹ️</span> Admin reviews & approves delivery before dispatch.
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="contact-phone-input" className="form-label">
                    WhatsApp / Mobile Number (optional)
                  </label>
                  <input
                    id="contact-phone-input"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. 9876543210 (receive WhatsApp updates)"
                    className="form-input"
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Receive order confirmation & pickup ready alert on WhatsApp.
                  </p>
                </div>
              )}

              {/* Special notes */}
              <div style={{ marginBottom: '1.125rem' }}>
                <label htmlFor="notes-input" className="form-label">Special Requests / Sizing Notes (optional)</label>
                <textarea
                  id="notes-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Need matching belt or accessory adjustments..."
                  className="form-input"
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Check Availability CTA */}
              <button
                id="check-availability-btn"
                type="button"
                onClick={checkAvailability}
                disabled={isChecking}
                className="btn-secondary"
                style={{ width: '100%', marginBottom: '1rem', padding: '0.625rem' }}
              >
                {isChecking ? 'Checking Boutique Availability…' : '🔍 Check Availability & Calculate Total'}
              </button>

              {/* Availability & Bill Breakdown */}
              {availability && (
                <div style={{
                  marginBottom: '1.25rem',
                  padding: '1rem',
                  borderRadius: '8px',
                  background: availability.isAvailable ? 'rgba(22,131,74,0.06)' : 'rgba(192,57,75,0.06)',
                  border: `1px solid ${availability.isAvailable ? 'rgba(22,131,74,0.25)' : 'rgba(192,57,75,0.25)'}`,
                }}>
                  {availability.isAvailable ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--success)', fontWeight: 600, fontSize: '0.875rem' }}>
                        <span>✓</span> Available for selected dates ({availability.availableQuantity} in stock)
                      </div>
                      <div style={{
                        borderTop: '1px solid rgba(22,131,74,0.15)',
                        paddingTop: '0.5rem',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Rental Duration ({availability.rentalDays} day{availability.rentalDays !== 1 ? 's' : ''}):</span>
                          <span>₹{(availability.priceEstimate || 0).toFixed(0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Fulfillment ({deliveryOption === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup'}):</span>
                          <span>{deliveryOption === 'HOME_DELIVERY' ? '₹50' : 'FREE'}</span>
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 700,
                          fontSize: '0.9375rem',
                          color: 'var(--brand-primary)',
                          borderTop: '1px dashed rgba(22,131,74,0.2)',
                          paddingTop: '0.375rem',
                          marginTop: '0.25rem',
                        }}>
                          <span>Total Payable:</span>
                          <span>₹{estimatedTotal.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--error)', fontWeight: 600, fontSize: '0.875rem' }}>
                      ✕ Sorry, this costume is fully booked for those dates. Try adjusting your dates.
                    </div>
                  )}
                </div>
              )}

              {/* Status messages */}
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

              {success && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.625rem 0.875rem',
                  background: 'rgba(22,131,74,0.08)',
                  border: '1px solid rgba(22,131,74,0.3)',
                  borderRadius: '6px',
                  color: 'var(--success)',
                  fontSize: '0.8125rem',
                }}>
                  🎉 {success}
                </div>
              )}

              {/* Submit Rental Order */}
              <button
                id="submit-rental-btn"
                type="button"
                onClick={submitRequest}
                disabled={isSubmitting || orderSuccess || product.totalStock <= 0 || (availability !== null && !availability.isAvailable)}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  fontSize: '0.9375rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(143,18,63,0.3)',
                }}
              >
                {isSubmitting ? (
                  <>
                    <svg style={{ animation: 'spin 1s linear infinite', height: '1.125rem', width: '1.125rem' }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Submitting Booking…</span>
                  </>
                ) : orderSuccess ? (
                  '✓ Booking Placed! Redirecting…'
                ) : product.totalStock <= 0 ? (
                  'Out of Stock'
                ) : user ? (
                  `Reserve Now · ₹${estimatedTotal.toFixed(0)}`
                ) : (
                  'Sign In to Reserve'
                )}
              </button>

              {orderSuccess && (
                <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => router.push('/my-orders')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-primary)',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
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

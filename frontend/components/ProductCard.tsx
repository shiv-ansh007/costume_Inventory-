import Link from 'next/link';
import Image from 'next/image';

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

const TYPE_CONFIG = {
  RENT: { label: 'Rent', bg: 'var(--surface-muted)', color: 'var(--brand-primary)', border: 'var(--brand-blush)' },
  SALE: { label: 'Sale', bg: '#EDFBF4', color: '#16834A', border: '#A8E6C4' },
  BOTH: { label: 'Rent & Buy', bg: '#FFF8E7', color: '#A96512', border: '#F0D090' },
};

export default function ProductCard({ product }: { product: Product }) {
  const badge = TYPE_CONFIG[product.type];
  const inStock = product.totalStock > 0;

  return (
    <Link href={`/catalog/${product.id}`} style={{ display: 'block', textDecoration: 'none' }}>
      <div
        className="card fade-up"
        style={{
          overflow: 'hidden',
          cursor: 'pointer',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.boxShadow = 'var(--shadow-card-hover)';
          el.style.transform = 'translateY(-2px)';
          const img = el.querySelector('.card-img') as HTMLElement | null;
          if (img) img.style.transform = 'scale(1.06)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.boxShadow = 'var(--shadow-card)';
          el.style.transform = 'translateY(0)';
          const img = el.querySelector('.card-img') as HTMLElement | null;
          if (img) img.style.transform = 'scale(1)';
        }}
      >
        {/* Image Container */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4/3',
          background: 'var(--surface-muted)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="card-img"
              style={{ objectFit: 'cover', transition: 'transform 0.4s ease' }}
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              background: 'var(--gradient-soft)',
            }}>
              <span style={{ fontSize: '2.5rem', opacity: 0.7 }}>👗</span>
              <span style={{ fontSize: '0.625rem', color: 'var(--brand-primary)', fontWeight: 600, letterSpacing: '0.05em', marginTop: '0.25rem' }}>
                DGS Boutique
              </span>
            </div>
          )}

          {/* Type badge */}
          <span style={{
            position: 'absolute',
            top: '0.5rem',
            left: '0.5rem',
            padding: '0.175rem 0.5rem',
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            borderRadius: '100px',
            background: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
            backdropFilter: 'blur(4px)',
          }}>{badge.label}</span>

          {/* Out of stock overlay */}
          {!inStock && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(36,21,29,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: '#fff',
                padding: '0.2rem 0.6rem',
                background: 'rgba(192,57,75,0.9)',
                borderRadius: '100px',
                letterSpacing: '0.05em',
              }}>OUT OF STOCK</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '0.75rem 0.875rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {/* Category */}
          <p style={{
            fontSize: '0.625rem',
            fontWeight: 700,
            color: 'var(--brand-gold)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '0.1rem',
          }}>
            {product.category || 'Costume'}
          </p>

          {/* Name */}
          <h3 style={{
            fontSize: 'clamp(0.8125rem, 1.2vw, 0.875rem)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            minHeight: '2.4em',
            wordBreak: 'break-word',
          }}>{product.name}</h3>

          {/* Price row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'auto',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              {product.rentalPrice && (
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                  ₹{Number(product.rentalPrice).toFixed(0)}
                  <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/day</span>
                </span>
              )}
              {product.salePrice && product.type !== 'RENT' && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Buy ₹{Number(product.salePrice).toFixed(0)}
                </span>
              )}
            </div>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: inStock ? 'var(--success)' : 'var(--error)',
            }}>
              {inStock ? `${product.totalStock} left` : 'Unavailable'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

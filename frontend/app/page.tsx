'use client';

import Link from 'next/link';

export default function HomePage() {
  const features = [
    {
      icon: '🎭',
      title: 'Curated Collection',
      desc: 'Hundreds of premium costumes — Historical, Fantasy, Halloween, Bollywood, Superhero, and more.',
    },
    {
      icon: '📅',
      title: 'Flexible Booking',
      desc: 'Pick your start and end dates. Live availability checks prevent double-booking automatically.',
    },
    {
      icon: '🚚',
      title: 'Doorstep Delivery',
      desc: 'Choose store pickup or home delivery. Real-time WhatsApp updates keep you in the loop.',
    },
  ];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section style={{
        background: 'var(--gradient-brand)',
        padding: 'clamp(3.5rem, 8vw, 6rem) 1.25rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: '-4rem', right: '-4rem',
          width: '20rem', height: '20rem',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-3rem', left: '-3rem',
          width: '14rem', height: '14rem',
          borderRadius: '50%',
          background: 'rgba(196,154,82,0.15)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: '42rem', margin: '0 auto' }}>
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid var(--brand-gold)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            margin: '0 auto 1.25rem',
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src="/dgs-logo.jpg"
              alt="DGS's Creation Logo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <span style={{
            display: 'inline-block',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--brand-blush)',
            textTransform: 'uppercase',
            marginBottom: '1rem',
            padding: '0.35rem 1rem',
            border: '1px solid rgba(233,184,200,0.35)',
            borderRadius: '100px',
            background: 'rgba(36,21,29,0.3)',
            backdropFilter: 'blur(8px)',
          }}>DGS&apos;s Creation · Passion Clothing</span>

          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(2rem, 5vw, 3.25rem)',
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.2,
            marginBottom: '1.25rem',
            letterSpacing: '-0.02em',
          }}>
            Dress the Part,<br />
            <span style={{ color: 'var(--brand-blush)' }}>Make a Statement</span>
          </h1>

          <p style={{
            fontSize: 'clamp(0.9375rem, 2vw, 1.0625rem)',
            color: 'rgba(255,255,255,0.8)',
            maxWidth: '30rem',
            margin: '0 auto 2.25rem',
            lineHeight: 1.65,
          }}>
            Browse our curated collection of costumes for events, photoshoots, and performances.
            Rent by the day or purchase outright.
          </p>

          <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/catalog"
              id="browse-catalog-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.75rem',
                background: '#fff',
                color: 'var(--brand-primary)',
                borderRadius: 'var(--radius-button)',
                fontWeight: 700,
                fontSize: '0.9375rem',
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              🎭 Browse Catalog
            </Link>
            <Link
              href="/register"
              id="get-started-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.75rem',
                background: 'transparent',
                color: '#fff',
                borderRadius: 'var(--radius-button)',
                fontWeight: 600,
                fontSize: '0.9375rem',
                textDecoration: 'none',
                border: '1.5px solid rgba(255,255,255,0.45)',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)';
              }}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── Browse by Category ────────────────────────────── */}
      <section style={{
        maxWidth: '72rem',
        margin: '0 auto',
        padding: 'clamp(2.5rem, 5vw, 3.5rem) 1.25rem 1rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--brand-gold)', textTransform: 'uppercase' }}>
            Curated Wardrobe
          </span>
          <h2 className="section-heading" style={{ fontSize: 'clamp(1.375rem, 3vw, 1.875rem)', marginTop: '0.35rem' }}>
            Explore Costumes by Category
          </h2>
          <div className="brand-divider" style={{ margin: '0.75rem auto 0' }} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 10.5rem), 1fr))',
          gap: '1rem',
        }}>
          {[
            { name: 'Cosplay', icon: '🎭', desc: 'Theatrical & anime suits', count: 'Popular' },
            { name: 'Kids', icon: '🎈', desc: 'Fairies, heroes & fun', count: 'Ages 3-12' },
            { name: 'Adult', icon: '👔', desc: 'Gentlemen & ladies gowns', count: 'Full Outfits' },
            { name: 'Accessories', icon: '👑', desc: 'Hats, props & swords', count: 'Props & Sets' },
            { name: 'Historical', icon: '⚔️', desc: 'Medieval, Victorian & retro', count: 'Classic' },
            { name: 'Festive', icon: '✨', desc: 'Celebrations & parties', count: 'Designer' },
          ].map((cat) => (
            <Link
              key={cat.name}
              href={`/catalog?category=${encodeURIComponent(cat.name)}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="card"
                style={{
                  padding: '1.25rem 1rem',
                  textAlign: 'center',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--border)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'var(--brand-primary)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                }}
              >
                <div style={{
                  width: '3.25rem',
                  height: '3.25rem',
                  borderRadius: '50%',
                  background: 'var(--surface-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem',
                  marginBottom: '0.75rem',
                  border: '1px solid var(--brand-blush)',
                }}>
                  {cat.icon}
                </div>
                <h3 style={{
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.25rem',
                }}>
                  {cat.name}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {cat.desc}
                </p>
                <span style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--brand-gold)',
                  letterSpacing: '0.05em',
                }}>
                  {cat.count} →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section style={{
        maxWidth: '72rem',
        margin: '0 auto',
        padding: 'clamp(2.5rem, 5vw, 4rem) 1.25rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 className="section-heading" style={{ fontSize: 'clamp(1.375rem, 3vw, 1.875rem)' }}>
            Why Choose CostumeRent?
          </h2>
          <div className="brand-divider" style={{ margin: '0.75rem auto 0' }} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 17rem), 1fr))',
          gap: '1.25rem',
        }}>
          {features.map((f) => (
            <div key={f.title} className="card" style={{ padding: '1.75rem 1.5rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '12px',
                background: 'var(--surface-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                marginBottom: '1rem',
              }}>{f.icon}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{f.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────── */}
      <section style={{ padding: '0 1.25rem clamp(2.5rem, 5vw, 4rem)' }}>
        <div style={{
          maxWidth: '72rem',
          margin: '0 auto',
          background: 'var(--gradient-soft)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: 'clamp(2rem, 4vw, 3rem) 2rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-2rem', right: '-2rem',
            width: '10rem', height: '10rem', borderRadius: '50%',
            background: 'rgba(196,154,82,0.12)', pointerEvents: 'none',
          }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--brand-gold)', textTransform: 'uppercase' }}>
            Ready to begin?
          </span>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0.75rem 0 0.625rem',
          }}>Find Your Perfect Costume Today</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
            Create a free account to start booking. Delivery available to your doorstep.
          </p>
          <Link href="/catalog" className="btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '0.9375rem' }}>
            Browse Catalog →
          </Link>
        </div>
      </section>
    </>
  );
}

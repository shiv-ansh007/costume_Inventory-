'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { productsApi } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const DEFAULT_CATEGORIES = [
  'All',
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

const TYPES = ['All', 'RENT', 'SALE', 'BOTH'];

function CatalogContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';

  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [type, setType] = useState('All');
  const [page, setPage] = useState(1);

  // Sync category if URL parameter changes
  useEffect(() => {
    const urlCategory = searchParams.get('category');
    if (urlCategory && urlCategory !== category) {
      setCategory(urlCategory);
    }
  }, [searchParams]);

  // Load dynamic categories from backend
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await productsApi.getCategories();
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const list = ['All', ...res.data];
          setCategories(Array.from(new Set(list)));
        }
      } catch {
        // Fallback to DEFAULT_CATEGORIES
      }
    };
    loadCategories();
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { page: String(page), limit: '12' };
      if (search.trim()) params.search = search.trim();
      if (category !== 'All') params.category = category;
      if (type !== 'All') params.type = type;

      const res = await productsApi.getAll(params);
      setProducts(res.data || []);
      setPagination(res.pagination || null);
    } catch {
      setError('Failed to load products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [search, category, type, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    setPage(1);
  }, [search, category, type]);

  const hasFilters = search.trim() !== '' || category !== 'All' || type !== 'All';

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: 'clamp(1.5rem, 4vw, 2.5rem) 1.25rem' }}>

      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="section-heading" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
          Costume Catalog
        </h1>
        <div className="brand-divider" />
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.625rem' }}>
          Discover handcrafted outfits & accessories curated by category
        </p>
      </div>

      {/* ─── Interactive Category Chips Bar ─── */}
      <div style={{
        marginBottom: '1.25rem',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: '0.5rem',
      }}>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          minWidth: 'max-content',
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--brand-gold)',
            marginRight: '0.35rem',
          }}>
            Categories:
          </span>
          {categories.map((c) => {
            const isSelected = category.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8125rem',
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: '100px',
                  border: isSelected ? '1.5px solid var(--brand-primary)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--brand-primary)' : 'var(--surface)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 12px rgba(143,18,63,0.25)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {c === 'All' && <span>✨</span>}
                {c === 'Cosplay' && <span>🎭</span>}
                {c === 'Kids' && <span>🎈</span>}
                {c === 'Adult' && <span>👔</span>}
                {c === 'Accessories' && <span>👑</span>}
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'flex-end',
        marginBottom: '1.75rem',
        padding: '1rem 1.25rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 12rem', minWidth: '12rem' }}>
          <svg
            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}
            width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="search-input"
            type="text"
            placeholder="Search costumes by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>

        {/* Category Dropdown */}
        <div style={{ flex: '1 1 10rem', minWidth: '10rem' }}>
          <select
            id="category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="form-input"
            style={{ cursor: 'pointer' }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? '✨ All Categories' : `👗 ${c}`}
              </option>
            ))}
          </select>
        </div>

        {/* Type Dropdown */}
        <div style={{ flex: '1 1 8.5rem', minWidth: '8.5rem' }}>
          <select
            id="type-filter"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="form-input"
            style={{ cursor: 'pointer' }}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All Types' : t}
              </option>
            ))}
          </select>
        </div>

        {/* Clear + Active info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setCategory('All'); setType('All'); }}
              style={{
                fontSize: '0.8125rem',
                color: 'var(--brand-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Reset filters
            </button>
          )}
          {pagination && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              <strong style={{ color: 'var(--brand-primary)' }}>{pagination.total}</strong> costume{pagination.total !== 1 ? 's' : ''} found
            </span>
          )}
        </div>
      </div>

      {/* Active Category Banner if filtered */}
      {category !== 'All' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.625rem 1rem',
          marginBottom: '1.25rem',
          background: 'var(--surface-muted)',
          border: '1px solid var(--brand-blush)',
          borderRadius: '8px',
        }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
            Showing outfits in category: <strong>{category}</strong>
          </span>
          <button
            onClick={() => setCategory('All')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Show All Outfits
          </button>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="product-catalog-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div className="skeleton" style={{ aspectRatio: '4/3' }} />
              <div style={{ padding: '0.875rem 1rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="skeleton" style={{ height: '0.625rem', width: '40%' }} />
                <div className="skeleton" style={{ height: '0.875rem', width: '75%' }} />
                <div className="skeleton" style={{ height: '0.625rem', width: '55%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 1rem',
          color: 'var(--error)',
          background: '#FFF0F0',
          borderRadius: 'var(--radius-card)',
          border: '1px solid #F5AABA',
          fontSize: '0.9rem',
        }}>
          {error}
        </div>
      ) : products.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '5rem 1rem',
          background: 'var(--surface)',
          border: '1px dashed var(--brand-blush)',
          borderRadius: 'var(--radius-card)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}>👗</div>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
            No costumes found in &quot;{category}&quot;
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Try browsing another category or reset your search filters.
          </p>
          <button
            onClick={() => { setSearch(''); setCategory('All'); setType('All'); }}
            className="btn-primary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
          >
            View All Costumes
          </button>
        </div>
      ) : (
        <div className="product-catalog-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.75rem',
          marginTop: '2.5rem',
        }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary"
            style={{ padding: '0.5rem 1.125rem' }}
          >
            ← Previous
          </button>
          <span style={{
            padding: '0.5rem 1rem',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}>
            Page <strong style={{ color: 'var(--text-primary)' }}>{page}</strong> of {pagination.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="btn-secondary"
            style={{ padding: '0.5rem 1.125rem' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '3rem 1.25rem', textAlign: 'center' }}>
        <div className="skeleton" style={{ height: '300px', borderRadius: '12px' }} />
      </div>
    }>
      <CatalogContent />
    </Suspense>
  );
}

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

export default function ProductCard({ product }: { product: Product }) {
  const typeBadge = {
    RENT: 'bg-blue-50 text-blue-700 border-blue-200',
    SALE: 'bg-green-50 text-green-700 border-green-200',
    BOTH: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <Link href={`/catalog/${product.id}`} className="block group">
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow">
        {/* Image */}
        <div className="relative w-full h-52 bg-gray-100">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          <span className={`absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded border ${typeBadge[product.type]}`}>
            {product.type}
          </span>
        </div>

        {/* Info */}
        <div className="p-4">
          <p className="text-xs text-gray-400 mb-1">{product.category || 'Uncategorized'}</p>
          <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-1">{product.name}</h3>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              {product.rentalPrice && (
                <span className="text-gray-900 font-medium">₹{Number(product.rentalPrice).toFixed(0)}<span className="text-gray-400 font-normal">/day</span></span>
              )}
              {product.salePrice && product.type !== 'RENT' && (
                <span className="text-gray-600 text-xs ml-2">Buy ₹{Number(product.salePrice).toFixed(0)}</span>
              )}
            </div>
            <span className={`text-xs ${product.totalStock > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {product.totalStock > 0 ? `${product.totalStock} in stock` : 'Out of stock'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

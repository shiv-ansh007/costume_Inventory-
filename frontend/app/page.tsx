import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Costume Rental Shop</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          Browse our wide collection of costumes for events, parties, photoshoots, and more.
          Rent by the day or purchase outright.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/catalog"
            id="browse-catalog-btn"
            className="px-6 py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Browse Catalog
          </Link>
          <Link
            href="/register"
            id="get-started-btn"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {[
          {
            title: 'Large Collection',
            desc: 'Hundreds of costumes across categories — from historical to fantasy, Halloween to Bollywood.',
            icon: '🎭',
          },
          {
            title: 'Flexible Booking',
            desc: 'Pick your start and end dates. We handle availability and prevent double-booking automatically.',
            icon: '📅',
          },
          {
            title: 'Easy Management',
            desc: 'Admins can upload, edit, and manage inventory in real-time. Approve or reject requests instantly.',
            icon: '⚙️',
          },
        ].map((f) => (
          <div key={f.title} className="border border-gray-200 rounded-lg p-6 bg-white">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA strip */}
      <div className="bg-gray-900 text-white rounded-lg p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Ready to find your costume?</h2>
        <p className="text-gray-400 text-sm mb-5">Create an account to start booking.</p>
        <Link
          href="/catalog"
          className="inline-block px-5 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Browse Now
        </Link>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'CostumeRent — Premium Costume Rental',
  description: 'Browse, book, and manage costume rentals online. Find the perfect costume for any occasion.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning style={{ margin: 0, background: 'var(--background)' }}>
        <AuthProvider>
          <Navbar />
          <main style={{ minHeight: 'calc(100vh - 3.75rem)', background: 'var(--background)' }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

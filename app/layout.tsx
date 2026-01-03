import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { AuthProvider } from '../lib/auth-context';

export const metadata: Metadata = {
  title: 'TFS Wholesalers - Quality Products at Wholesale Prices',
  description: 'Your trusted wholesale supplier for groceries, home supplies, appliances, and cleaning products.',
  keywords: 'wholesale, groceries, home supplies, appliances, cleaning supplies, bulk products',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1A1A1A',
                color: '#fff',
                borderRadius: '0.75rem',
              },
              success: {
                iconTheme: {
                  primary: '#FF6B35',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
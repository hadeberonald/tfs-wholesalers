import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ConditionalHeader from '@/components/ConditionalHeader';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TFS Wholesalers - Quality Products at Wholesale Prices',
  description: 'South Africa\'s trusted wholesale supplier',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ConditionalHeader />
          <main>{children}</main>
          <Footer />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#363636',
                color: '#fff',
                maxWidth: '500px',
              },
              success: {
                duration: 3000,
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
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister/ServiceWorkerRegister';
import AnnouncementBar from '@/components/AnnouncementBar/AnnouncementBar';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

export const metadata = {
  title: 'One Bite | Premium Handcrafted Cookies',
  description: 'Order freshly baked, handcrafted premium cookies online. Pickup or delivery. One Bite is all it takes.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <ServiceWorkerRegister />
              <AnnouncementBar />
              {children}
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

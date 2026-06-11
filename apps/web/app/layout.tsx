import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SwRegister } from '@/components/ui/sw-register';
import { InstallPrompt } from '@/components/ui/install-prompt';
import { NativeBridge } from '@/components/native-bridge';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Didi — Order Food Online in Ghana',
    template: '%s | Didi',
  },
  description:
    'The easiest way for restaurants in Ghana to accept and manage food orders online. Share your menu, accept payments via Mobile Money or Card, and deliver to customers.',
  keywords: [
    'food ordering',
    'Ghana',
    'restaurant',
    'mobile money',
    'online food',
    'delivery',
    'Didi',
  ],
  icons: {
    icon: '/images/didi_favicon.png',
    apple: '/images/didi_apple.png',
  },
  openGraph: {
    title: 'Didi — Order Food Online in Ghana',
    description:
      'The easiest way for restaurants in Ghana to accept and manage food orders online.',
    locale: 'en_GH',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Didi',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Let content extend under the notch / home indicator so we can pad with safe-area insets.
  viewportFit: 'cover',
  // Avoid locking zoom entirely (accessibility); just prevent the iOS focus auto-zoom via 16px inputs.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0D0D0F' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <NativeBridge />
        <SwRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}

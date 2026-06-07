import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { NativeBridge } from './native-bridge';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

// Static title only — no SEO in a binary, no generateMetadata (that needed a
// server fetch). Per-restaurant branding is applied client-side from the payload.
export const metadata: Metadata = {
  title: 'Didi',
  icons: { icon: '/images/didi_favicon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover', // extend under notch; pad with safe-area insets
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} pt-safe pb-safe bg-canvas`}>
        <Providers>
          <NativeBridge />
          {children}
        </Providers>
      </body>
    </html>
  );
}

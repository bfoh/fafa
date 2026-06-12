import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { NativeBridge } from './native-bridge';

// Same body face as the web app (see apps/web/app/layout.tsx).
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
});

// Same display face as the web app so cross-aliased components (which use
// var(--font-display)) render identically inside the native shell.
const display = Bricolage_Grotesque({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
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
      <body className={`${jakarta.variable} ${display.variable} pt-safe pb-safe bg-canvas`}>
        <Providers>
          <NativeBridge />
          {children}
        </Providers>
      </body>
    </html>
  );
}

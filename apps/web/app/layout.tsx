import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

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
  openGraph: {
    title: 'Didi — Order Food Online in Ghana',
    description:
      'The easiest way for restaurants in Ghana to accept and manage food orders online.',
    locale: 'en_GH',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}

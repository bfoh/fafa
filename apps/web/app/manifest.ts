import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Didi — Order Food in Ghana',
    short_name: 'Didi',
    description: 'Order from the best local kitchens near you.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0910',
    theme_color: '#0b0910',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

'use client';

import { useEffect } from 'react';

interface BrandingCacheProps {
  slug: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
}

export function BrandingCache({
  slug,
  name,
  logoUrl,
  primaryColor,
}: BrandingCacheProps) {
  useEffect(() => {
    if (slug) {
      const branding = {
        name,
        logoUrl: logoUrl || '',
        primaryColor: primaryColor || '#FF6B35',
        slug,
      };
      localStorage.setItem('fafa_last_tenant', JSON.stringify(branding));
      document.cookie = `fafa_last_tenant_slug=${slug}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [slug, name, logoUrl, primaryColor]);

  return null;
}

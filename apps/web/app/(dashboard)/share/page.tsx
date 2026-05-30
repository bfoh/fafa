'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import QRCode from 'qrcode';
import { getBaseUrl } from '@/lib/utils';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Send,
  Printer,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';

export default function SharePage() {
  const supabase = createBrowserClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flyerCanvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#FF6B35');
  const [storefrontUrl, setStorefrontUrl] = useState('');

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadTenant() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const tId = await getResolvedTenantIdClient(supabase, session);

        if (tId) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name, slug, primary_color')
            .eq('id', tId)
            .single();

          if (tenant) {
            setTenantName(tenant.name);
            setTenantSlug(tenant.slug);
            setPrimaryColor(tenant.primary_color || '#FF6B35');

            const baseUrl = getBaseUrl();
            const storefront = `${baseUrl}/${tenant.slug}`;
            setStorefrontUrl(storefront);
          }
        }
      } catch (err) {
        console.error('Failed to load sharing settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTenant();
  }, []);

  // Generate QR Code on canvas
  useEffect(() => {
    if (!loading && storefrontUrl && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        storefrontUrl,
        {
          width: 256,
          margin: 1,
          color: {
            dark: primaryColor,
            light: '#FFFFFF',
          },
        },
        (error) => {
          if (error) console.error('Error generating main QR:', error);
        }
      );
    }
    if (!loading && storefrontUrl && flyerCanvasRef.current) {
      QRCode.toCanvas(
        flyerCanvasRef.current,
        storefrontUrl,
        {
          width: 320,
          margin: 1,
          color: {
            dark: '#1A1A2E', // High contrast dark for prints
            light: '#FFFFFF',
          },
        },
        (error) => {
          if (error) console.error('Error generating flyer QR:', error);
        }
      );
    }
  }, [loading, storefrontUrl, primaryColor]);

  // Copy link to clipboard
  function handleCopy() {
    navigator.clipboard.writeText(storefrontUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Share to WhatsApp
  function handleWhatsAppShare() {
    const text = encodeURIComponent(
      `Hello! You can now place food orders from ${tenantName} online. See our menu and order here: ${storefrontUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  // Trigger browser print
  function handlePrintFlyer() {
    window.print();
  }

  // Download high-res PNG
  async function downloadPNG() {
    try {
      const dataUrl = await QRCode.toDataURL(storefrontUrl, {
        width: 1000,
        margin: 1,
        color: {
          dark: primaryColor,
          light: '#FFFFFF',
        },
      });
      const link = document.createElement('a');
      link.download = `${tenantSlug}-qr-code.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG download error:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-surface-500 mt-2">Loading sharing assets...</p>
      </div>
    );
  }

  if (!storefrontUrl) {
    return (
      <div className="p-6 text-center">
        <p className="text-surface-500 font-medium">No restaurant found for this account.</p>
        <p className="text-sm text-surface-400 mt-1">Please ensure you have onboarded or created a restaurant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Print Stylesheet (Inject dynamically) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-flyer-area, #print-flyer-area * {
            visibility: visible;
          }
          #print-flyer-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            background: white !important;
            color: #1a1a2e !important;
          }
        }
      `}</style>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <QrCode className="w-6 h-6 text-brand-500" />
          Share & QR Code
        </h1>
        <p className="text-surface-500 text-sm mt-1">
          Share your online storefront link or print your customized QR code flyers.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Share Card & Actions */}
        <div className="bg-white rounded-2xl border border-surface-100 p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-surface-900">Your Storefront Link</h2>
              <p className="text-xs text-surface-400 mt-0.5">Customers click this link to view your menu.</p>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={storefrontUrl}
                className="flex-1 px-4 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-surface-700 text-xs focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={handleWhatsAppShare}
                className="flex-1 min-w-[140px] px-4 py-2.5 bg-success-600 hover:bg-success-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Send className="w-4 h-4" />
                Share on WhatsApp
              </button>
              <Link
                href={storefrontUrl}
                target="_blank"
                className="flex-1 min-w-[140px] px-4 py-2.5 border border-surface-200 text-surface-700 hover:bg-surface-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Open Storefront
              </Link>
            </div>
          </div>

          <div className="border-t border-surface-100 pt-6 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-surface-900">Download QR Code</h2>
              <p className="text-xs text-surface-400 mt-0.5">High quality PNG image for your social media posts.</p>
            </div>
            <button
              onClick={downloadPNG}
              className="w-full py-3 bg-surface-900 hover:bg-surface-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Download className="w-4.5 h-4.5" />
              Download QR Image (PNG)
            </button>
          </div>
        </div>

        {/* QR Card Preview */}
        <div className="bg-white rounded-2xl border border-surface-100 p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
          <div
            className="p-5 rounded-3xl shadow-lg border border-surface-100 flex flex-col items-center"
            style={{ borderColor: `${primaryColor}20` }}
          >
            <span
              className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4"
              style={{ background: `${primaryColor}15`, color: primaryColor }}
            >
              {tenantName}
            </span>
            <canvas ref={canvasRef} className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
            <p className="text-[10px] text-surface-400 font-semibold uppercase tracking-wider mt-4">
              Scan to Order Online
            </p>
          </div>

          <button
            onClick={handlePrintFlyer}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <Printer className="w-4 h-4" />
            Print Storefront Flyer
          </button>
        </div>
      </div>

      {/* Hidden Printable Flyer Content (Becomes visible only in print mode via CSS media query) */}
      <div
        id="print-flyer-area"
        className="hidden p-12 border-8 border-double border-surface-900 text-center max-w-lg mx-auto bg-white flex-col items-center justify-center space-y-6"
        style={{ borderWidth: '12px' }}
      >
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight uppercase" style={{ color: '#1A1A2E' }}>
            {tenantName}
          </h1>
          <p className="text-sm font-semibold tracking-widest text-surface-500 uppercase">
            Taste of Good Food
          </p>
        </div>

        <div className="bg-white p-4 border border-surface-300 rounded-3xl shadow-sm flex flex-col items-center">
          <h2 className="text-md font-bold uppercase tracking-wider mb-3" style={{ color: '#1A1A2E' }}>
            Scan to View Menu & Order!
          </h2>
          <canvas ref={flyerCanvasRef} className="w-64 h-64 object-contain" />
          <p className="text-[11px] text-surface-400 font-bold uppercase mt-3 tracking-widest text-surface-500">
            {storefrontUrl.replace(/^https?:\/\//, '')}
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-md font-bold uppercase" style={{ color: '#FF6B35' }}>
            📱 Order · 💳 Pay · 🚗 Get Delivered
          </p>
          <p className="text-xs text-surface-400 italic">
            Supports Card & Mobile Money payments (MTN MoMo, Vodafone, AirtelTigo)
          </p>
        </div>

        <div className="pt-6 border-t border-surface-200 w-full flex justify-between items-center text-[10px] font-bold text-surface-400 uppercase tracking-widest">
          <span>Powered by Didi</span>
          <span>didi.com.gh</span>
        </div>
      </div>
    </div>
  );
}

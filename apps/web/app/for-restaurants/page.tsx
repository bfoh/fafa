'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  QrCode,
  Smartphone,
  CreditCard,
  BarChart3,
  ShoppingBag,
  Zap,
  ArrowRight,
  CheckCircle,
  Star,
  Flame,
  Volume2,
  Bell,
  Menu,
  ChevronLeft,
  Search,
  Filter,
  MapPin,
  Heart,
  Sparkles
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  kcal: number;
  protein: string;
  fats: string;
  image: string;
  description: string;
  rating: number;
  reviews: string;
}

interface SimulatedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  status: 'pending' | 'cooking' | 'ready' | 'delivered';
  time: string;
}

export default function ForRestaurantsPage() {
  const menuItems: MenuItem[] = [
    {
      id: 'item-1',
      name: 'Ghanaian Jollof Feast',
      price: 65,
      kcal: 680,
      protein: '28.4g',
      fats: '14.2g',
      image: '/images/jollof_hero.png',
      description: 'Slow-cooked spiced rice with rich tomato base, served with tender grilled chicken, sweet fried plantains (kelewele), and fresh salad.',
      rating: 4.9,
      reviews: '1.2K'
    },
    {
      id: 'item-2',
      name: 'Spicy Kelewele Box',
      price: 25,
      kcal: 340,
      protein: '4.2g',
      fats: '9.8g',
      image: '/images/kelewele_hero.png',
      description: 'Ripe plantain cubes seasoned with fresh ginger, peppers, and authentic local spices, fried to golden perfection and topped with roasted peanuts.',
      rating: 4.7,
      reviews: '640'
    },
    {
      id: 'item-3',
      name: 'Charcoal Grilled Kebab',
      price: 35,
      kcal: 420,
      protein: '34.5g',
      fats: '11.1g',
      image: '🍢',
      description: 'Succulent skewers of dry-rubbed beef or goat, dusted with house kankankan spice blend, grilled over hot charcoal.',
      rating: 4.8,
      reviews: '890'
    },
  ];

  // Simulator States
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'discover' | 'menu' | 'details'>('discover');
  const [cart, setCart] = useState<Array<{ item: MenuItem; quantity: number }>>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem>(menuItems[0]);
  const [isFavorite, setIsFavorite] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [isProcessingPay, setIsProcessingPay] = useState(false);
  const [orders, setOrders] = useState<SimulatedOrder[]>([
    {
      id: 'demo-1',
      orderNumber: 'DI-0024',
      customerName: 'Kofi Mensah',
      items: [{ name: 'Spicy Kelewele Box', quantity: 2, price: 25 }],
      total: 50,
      status: 'cooking',
      time: '2 mins ago',
    },
  ]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    setActiveShowcaseTab('details');
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.item.id !== itemId));
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);
  }, [cart]);

  // Native audio chime using Web Audio API (Type-safe configuration)
  const playNativeChime = () => {
    try {
      const AudioCtxClass = typeof window !== 'undefined'
        ? (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
        : null;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      
      // Tone 1 (Ding)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      gain1.gain.setValueAtTime(0, audioCtx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.4);
      
      // Tone 2 (Dong)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.setValueAtTime(392.00, audioCtx.currentTime + 0.15); // G4
      gain2.gain.setValueAtTime(0, audioCtx.currentTime + 0.15);
      gain2.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn('Audio Context failed to initialize:', e);
    }
  };

  const submitSimulatedOrder = () => {
    if (cart.length === 0) return;
    setIsProcessingPay(true);

    setTimeout(() => {
      const newOrder: SimulatedOrder = {
        id: `sim-${Date.now()}`,
        orderNumber: `DI-0${Math.floor(100 + Math.random() * 900)}`,
        customerName: 'Ama Serwaa',
        items: cart.map((c) => ({
          name: c.item.name,
          quantity: c.quantity,
          price: c.item.price,
        })),
        total: subtotal + 15, // subtotal + GH₵ 15.00 delivery fee
        status: 'pending',
        time: 'Just now',
      };

      setOrders((prev) => [newOrder, ...prev]);
      setCart([]);
      setIsProcessingPay(false);
      playNativeChime();
      setSuccessMsg('🔔 Order Sent! Check Live Orders board below.');
      setTimeout(() => setSuccessMsg(''), 5000);
    }, 1200);
  };

  const submitSingleItemOrder = (item: MenuItem) => {
    setIsProcessingPay(true);
    setTimeout(() => {
      const newOrder: SimulatedOrder = {
        id: `sim-${Date.now()}`,
        orderNumber: `DI-0${Math.floor(100 + Math.random() * 900)}`,
        customerName: 'Ama Serwaa',
        items: [{ name: item.name, quantity: 1, price: item.price }],
        total: item.price + 15,
        status: 'pending',
        time: 'Just now',
      };

      setOrders((prev) => [newOrder, ...prev]);
      setIsProcessingPay(false);
      playNativeChime();
      setSuccessMsg('🔔 Order Sent! Check Live Orders board below.');
      setTimeout(() => setSuccessMsg(''), 5000);
    }, 1200);
  };

  const updateOrderStatus = (orderId: string, nextStatus: SimulatedOrder['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#0D0B0A] text-surface-200 selection:bg-brand-500 selection:text-white font-sans overflow-x-hidden relative">
      {/* Dynamic Glowing Mesh Orbs (Placed behind layout elements) */}
      <div className="absolute top-[-10%] right-[-10%] w-[650px] h-[650px] rounded-full bg-brand-500/10 blur-[150px] pointer-events-none z-0" />
      <div className="absolute top-[30%] left-[-20%] w-[700px] h-[700px] rounded-full bg-[#E85520]/15 blur-[160px] pointer-events-none z-0 animate-pulse-soft" />
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[140px] pointer-events-none z-0" />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#0D0B0A]/60 backdrop-blur-2xl border-b border-white/[0.06] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-white tracking-widest flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(232,85,32,0.4)] border border-white/10">
              <Image
                src="/images/didi_logo.png"
                alt="Didi Logo"
                fill
                priority
                className="object-cover"
                sizes="32px"
              />
            </div>
            <span>Didi</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-surface-400 hover:text-white transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-bold text-white bg-gradient-to-r from-brand-500 to-orange-500 hover:from-brand-600 hover:to-orange-600 px-5 py-3 rounded-xl transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(255,107,53,0.25)] hover:shadow-[0_0_25px_rgba(255,107,53,0.4)]"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 lg:pt-24 lg:pb-20 text-center lg:text-left">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-400 text-[10px] font-extrabold uppercase tracking-widest animate-bounce">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>🇬🇭</span> The Operating System for Ghana&apos;s Food Businesses
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] max-w-3xl mx-auto">
            The Modern Storefront for{' '}
            <span className="bg-gradient-to-r from-brand-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Ghana&apos;s Finest Kitchens
            </span>
          </h1>
          <p className="text-base sm:text-lg text-surface-400 max-w-2xl mx-auto leading-relaxed">
            Create customized, premium storefronts. Share branded QR codes.
            Accept Mobile Money + Card payments. Manage live orders with native audio chime notifications. Everything your restaurant needs to scale online with Didi.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/register"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-orange-500 text-white font-bold text-lg hover:from-brand-600 hover:to-orange-600 transition-all active:scale-[0.98] shadow-lg shadow-brand-500/20 w-full sm:w-auto justify-center"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#sandbox-demo"
              className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-lg transition-all w-full sm:w-auto text-center cursor-pointer"
            >
              Try Live Demo
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 pt-6 text-[10px] sm:text-xs text-surface-500 font-semibold tracking-wider uppercase">
            <span>✓ No Setup Fees</span>
            <span>✓ 2-Min Onboarding</span>
            <span>✓ Auto-SMS Alerts</span>
          </div>
        </div>
      </header>

      {/* 3-Device High-Fidelity Interactive Showcase Section */}
      <section id="sandbox-demo" className="relative z-10 py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Glow backlight behind the phone mockup container */}
        <div className="absolute top-[25%] left-[20%] w-[350px] h-[350px] rounded-full bg-brand-500/15 blur-[130px] pointer-events-none z-0" />
        <div className="absolute top-[40%] right-[20%] w-[380px] h-[380px] rounded-full bg-amber-500/15 blur-[120px] pointer-events-none z-0" />

        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3 relative z-10">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Premium Interactive Storefront Demo
          </h2>
          <p className="text-surface-400 text-xs sm:text-sm max-w-2xl mx-auto">
            Interact with the simulated flow below: click products on the **Browser**, toggle favorites, and select **Simulate MoMo Payment** on the **Details screen** to play the real-time order alert and feed the Merchant Orders Board!
          </p>
          {successMsg && (
            <div className="inline-block px-4 py-2 rounded-xl bg-brand-500/10 border border-brand-500/25 text-brand-400 text-xs font-semibold animate-bounce mt-3 shadow-[0_0_15px_rgba(255,107,53,0.15)]">
              {successMsg}
            </div>
          )}
        </div>

        {/* Mobile View Showcase Selector (Tab Bar) */}
        <div className="flex justify-center gap-1.5 p-1.5 rounded-full bg-white/[0.04] backdrop-blur-md border border-white/[0.08] max-w-[300px] mx-auto mb-8 lg:hidden z-20 relative shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] animate-fade-in">
          {[
            { id: 'discover', label: '1. Discover', icon: '📱' },
            { id: 'menu', label: '2. Menu', icon: '🍚' },
            { id: 'details', label: '3. Details', icon: '🍗' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveShowcaseTab(tab.id as 'discover' | 'menu' | 'details')}
              className={`flex-grow py-2 px-3 rounded-full text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 border ${
                activeShowcaseTab === tab.id
                  ? 'bg-gradient-to-r from-brand-500/15 to-orange-500/15 border-brand-400/80 text-white shadow-md'
                  : 'bg-transparent border-transparent text-surface-400 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8 justify-center items-start relative z-10">
          
          {/* DEVICE 1: Discover Cover (Left) */}
          <div className={`${activeShowcaseTab === 'discover' ? 'flex' : 'hidden lg:flex'} flex-col items-center animate-fade-in`}>
            <span className="text-xs text-surface-500 uppercase tracking-widest font-bold mb-3">Screen 1 · Discover Store</span>
            
            {/* Phone Mockup Frame */}
            <div className="w-[300px] h-[610px] rounded-[44px] border-[10px] border-[#2C2621] bg-[#120F0D]/65 backdrop-blur-[24px] border border-white/[0.08] relative shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),inset_0_1px_1.5px_rgba(255,255,255,0.15)] overflow-hidden flex flex-col group">
              <div className="absolute top-0 inset-x-0 h-6 bg-black flex justify-center items-center z-30">
                <div className="w-20 h-3 bg-black rounded-b-xl" />
              </div>

              {/* Background Hero Image */}
              <div className="absolute inset-0 z-0">
                <Image
                  src="/images/jollof_hero.png"
                  alt="Ghanaian Jollof"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  sizes="300px"
                  priority
                />
                {/* Visual Splash Highlight Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141210] via-[#141210]/30 to-transparent" />
                <div className="absolute top-1/4 right-0 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
              </div>

              {/* Screen Contents */}
              <div className="relative z-10 flex-1 flex flex-col justify-between p-6 pt-10 text-left">
                <div className="flex justify-between items-center">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 shadow-lg">
                    <Image
                      src="/images/didi_logo.png"
                      alt="Didi Logo"
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-white/60 bg-black/45 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/[0.05]">
                    9:41
                  </span>
                </div>

                {/* Frosted Glass overlay text box */}
                <div className="space-y-4 bg-black/50 backdrop-blur-xl border border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] rounded-3xl p-5 m-[-10px] z-10">
                  <h3 className="text-2xl font-black text-white leading-tight tracking-tight">
                    Discover <br />
                    Delicious Food <br />
                    Near You
                  </h3>
                  <p className="text-[10.5px] text-surface-300 leading-relaxed">
                    Freshly prepared premium local delights, dispatched hot to your doorstep with Didi.
                  </p>
                  
                  <button 
                    onClick={() => {
                      setActiveShowcaseTab('menu');
                      setTimeout(() => {
                        const demoSection = document.getElementById('device-browser');
                        demoSection?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-500 to-orange-500 text-white font-bold text-xs shadow-lg shadow-brand-500/30 flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <span>Browse Menu</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* DEVICE 2: Storefront Browser (Middle) */}
          <div id="device-browser" className={`${activeShowcaseTab === 'menu' ? 'flex' : 'hidden lg:flex'} flex-col items-center animate-fade-in`}>
            <span className="text-xs text-surface-500 uppercase tracking-widest font-bold mb-3">Screen 2 · Category Menu</span>

            {/* Phone Mockup Frame */}
            <div className="w-[300px] h-[610px] rounded-[44px] border-[10px] border-[#2C2621] bg-gradient-to-br from-[#1C1714] via-[#221C1A] to-[#120F0D] relative shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),inset_0_1px_1.5px_rgba(255,255,255,0.15)] overflow-hidden flex flex-col">
              <div className="absolute top-0 inset-x-0 h-6 bg-black flex justify-center items-center z-30">
                <div className="w-20 h-3 bg-black rounded-b-xl" />
              </div>

              {/* Internal glow meshes behind elements inside browser */}
              <div className="absolute top-[20%] left-[-20%] w-48 h-48 rounded-full bg-brand-500/10 blur-3xl pointer-events-none z-0" />
              <div className="absolute bottom-[-10%] right-[-10%] w-40 h-40 rounded-full bg-orange-600/15 blur-2xl pointer-events-none z-0 animate-pulse-soft" />

              {/* Status Header */}
              <div className="p-4 pt-8 pb-2 flex items-center justify-between z-10 relative">
                <button className="w-8 h-8 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/[0.1] flex items-center justify-center text-white hover:bg-white/10 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Menu className="w-4 h-4" />
                </button>
                
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-surface-500 font-bold uppercase tracking-wider">Location</span>
                  <button className="flex items-center gap-1 text-[11px] font-black text-white hover:text-brand-400 transition-colors">
                    <MapPin className="w-3 h-3 text-brand-400" />
                    Accra (GH)
                    <span className="text-[8px]">▼</span>
                  </button>
                </div>

                <button className="w-8 h-8 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/[0.1] flex items-center justify-center text-white hover:bg-white/10 transition-colors relative shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                </button>
              </div>

              {/* Search Bar (Glassmorphic) */}
              <div className="px-4 py-2 flex items-center gap-2 z-10 relative">
                <div className="flex-1 h-9 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/[0.1] flex items-center px-3 gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                  <Search className="w-3.5 h-3.5 text-surface-500" />
                  <input
                    type="text"
                    placeholder="Search food or..."
                    disabled
                    className="bg-transparent border-none text-[11px] text-white focus:outline-none placeholder-surface-500 w-full cursor-not-allowed"
                  />
                </div>
                <button className="w-9 h-9 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/[0.1] flex items-center justify-center text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                  <Filter className="w-3.5 h-3.5 text-brand-400" />
                </button>
              </div>

              {/* Popular Categories Scroll */}
              <div className="px-4 py-2 flex-shrink-0 z-10 relative">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider">Popular Categories</span>
                  <span className="text-[10px] text-brand-400 font-bold cursor-pointer hover:underline">See all</span>
                </div>
                
                <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    { name: 'Jollof', icon: '🍚', active: true },
                    { name: 'Kelewele', icon: '🍌', active: false },
                    { name: 'Kebab', icon: '🍢', active: false },
                    { name: 'Drinks', icon: '🥤', active: false },
                  ].map((cat, idx) => (
                    <button
                      key={idx}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold transition-all border ${
                        cat.active
                          ? 'bg-white/[0.12] backdrop-blur-md border-amber-500/80 text-white shadow-[0_0_15px_rgba(245,158,11,0.25),inset_0_1px_1px_rgba(255,255,255,0.15)]'
                          : 'bg-white/[0.05] backdrop-blur-md border border-white/[0.09] text-surface-300 hover:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu items scroll area (Frosted glass cards) */}
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 scrollbar-thin z-10 relative">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedItem(item);
                      setActiveShowcaseTab('details');
                    }}
                    className={`p-3 bg-white/[0.03] backdrop-blur-md rounded-2xl border transition-all duration-300 flex items-center gap-3 cursor-pointer ${
                      selectedItem.id === item.id 
                        ? 'border-white/[0.18] bg-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]' 
                        : 'border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                      {item.image.length > 2 ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <span className="text-xl">{item.image}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11px] font-extrabold text-white truncate">{item.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-brand-400 font-bold">GH₵ {item.price.toFixed(2)}</span>
                        <span className="text-[9px] text-surface-500">•</span>
                        <div className="flex items-center gap-0.5 text-[9px] text-warning-400 font-bold">
                          <Star className="w-2.5 h-2.5 fill-warning-400" />
                          {item.rating}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(item);
                        setSelectedItem(item);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-brand-500 text-white font-extrabold text-[9px] hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/10 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>

              {/* Stateful Cart Summary (Frosted Glass) */}
              <div className="p-4 border-t border-white/[0.08] bg-[#120F0D]/85 backdrop-blur-2xl flex flex-col gap-2 flex-shrink-0 z-10 relative">
                {cart.length > 0 ? (
                  <div className="space-y-2">
                    <div className="max-h-[65px] overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
                      {cart.map((c) => (
                        <div key={c.item.id} className="flex justify-between items-center text-[10px] text-surface-400">
                          <span className="truncate max-w-[120px] font-medium">{c.quantity}x {c.item.name}</span>
                          <div className="flex items-center gap-2">
                            <span>GH₵ {(c.item.price * c.quantity).toFixed(2)}</span>
                            <button
                              onClick={() => removeFromCart(c.item.id)}
                              className="text-error-500 hover:text-error-600 font-black text-xs px-1"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={submitSimulatedOrder}
                      disabled={isProcessingPay}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-orange-500 text-white font-bold text-xs hover:from-brand-600 hover:to-orange-600 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/10 cursor-pointer disabled:opacity-50"
                    >
                      {isProcessingPay ? 'Processing...' : `Place Cart Order (GH₵ ${subtotal.toFixed(2)})`}
                    </button>
                  </div>
                ) : (
                  <p className="text-[9px] text-surface-500 text-center py-2 font-medium">Select items from the menu to build your cart</p>
                )}
              </div>
            </div>
          </div>

          {/* DEVICE 3: Product Details & Momo (Right) */}
          <div className={`${activeShowcaseTab === 'details' ? 'flex' : 'hidden lg:flex'} flex-col items-center animate-fade-in`}>
            <span className="text-xs text-surface-500 uppercase tracking-widest font-bold mb-3">Screen 3 · Product Details</span>

            {/* Phone Mockup Frame */}
            <div className="w-[300px] h-[610px] rounded-[44px] border-[10px] border-[#2C2621] bg-[#120F0D]/65 backdrop-blur-[24px] border border-white/[0.08] relative shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),inset_0_1px_1.5px_rgba(255,255,255,0.15)] overflow-hidden flex flex-col">
              <div className="absolute top-0 inset-x-0 h-6 bg-black flex justify-center items-center z-30">
                <div className="w-20 h-3 bg-black rounded-b-xl" />
              </div>

              {/* Glowing backlights behind details card layout inside phone */}
              <div className="absolute bottom-10 right-4 w-32 h-32 rounded-full bg-[#E85520]/25 blur-[35px] z-0 pointer-events-none animate-pulse-soft" />
              <div className="absolute bottom-28 left-4 w-28 h-28 rounded-full bg-amber-500/20 blur-[30px] z-0 pointer-events-none" />

              {/* Detail Header */}
              <div className="p-4 pt-8 pb-2 flex justify-between items-center absolute top-0 inset-x-0 z-20">
                <button 
                  onClick={() => {
                    setSelectedItem(menuItems[0]);
                    setActiveShowcaseTab('menu');
                  }}
                  className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.08] flex items-center justify-center text-white hover:bg-black/60 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="text-xs font-black text-white uppercase tracking-widest bg-black/45 backdrop-blur-md px-3 py-1 rounded-full border border-white/[0.05]">
                  Details
                </span>

                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.08] flex items-center justify-center hover:bg-black/60 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  <Heart className={`w-4 h-4 transition-all duration-300 ${isFavorite ? 'fill-brand-500 text-brand-500 drop-shadow-[0_0_8px_rgba(255,107,53,0.6)]' : 'text-white'}`} />
                </button>
              </div>

              {/* Floating High-Res Food Asset Display Area */}
              <div className="h-64 relative bg-[#1E1B18] flex items-center justify-center overflow-hidden flex-shrink-0 z-0">
                {selectedItem.image.length > 2 ? (
                  <Image
                    src={selectedItem.image}
                    alt={selectedItem.name}
                    fill
                    className="object-cover"
                    sizes="300px"
                    priority
                  />
                ) : (
                  <span className="text-7xl animate-pulse">{selectedItem.image}</span>
                )}
                {/* Dark Gradient Overlay at the base of the image */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#141210] to-transparent z-10" />
              </div>

              {/* True Frosted Glass Details Bottom Card (Highly transparent with white specular glints) */}
              <div className="flex-1 bg-stone-900/[0.42] backdrop-blur-[32px] border-t border-x border-white/[0.12] shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.22),0_-10px_25px_-5px_rgba(0,0,0,0.6)] rounded-t-[36px] -mt-10 p-5 z-10 flex flex-col justify-between">
                
                <div className="space-y-3.5">
                  {/* Name and Price */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="text-base font-black text-white leading-tight">{selectedItem.name}</h3>
                      <p className="text-[10px] text-surface-500 font-bold flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-brand-400" />
                        East Legon · Accra
                      </p>
                    </div>
                    <span className="text-sm font-black text-brand-400 bg-brand-500/15 border border-brand-400/40 px-2.5 py-1 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      GH₵ {selectedItem.price}
                    </span>
                  </div>

                  {/* Rating / Review info */}
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="w-4 h-4 rounded-full border border-black bg-surface-700 flex items-center justify-center text-[7px] text-white font-bold">
                          👤
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] font-bold text-surface-300 flex items-center gap-1">
                      <Star className="w-3 h-3 text-warning-400 fill-warning-400" />
                      {selectedItem.rating}
                      <span className="text-surface-500 font-normal">({selectedItem.reviews} reviews)</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[10px] text-surface-400 leading-relaxed font-medium line-clamp-3">
                    {selectedItem.description}
                  </p>

                  {/* Macro Nutritional Pills (Frosted Glass) */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="flex items-center gap-1 text-[9px] font-extrabold text-white/90 bg-white/[0.06] backdrop-blur-md border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] rounded-full px-2.5 py-1.5">
                      <Flame className="w-3 h-3 text-brand-400" />
                      {selectedItem.kcal} kcal
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-extrabold text-white/90 bg-white/[0.06] backdrop-blur-md border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] rounded-full px-2.5 py-1.5">
                      🥩 {selectedItem.protein} protein
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-extrabold text-white/90 bg-white/[0.06] backdrop-blur-md border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] rounded-full px-2.5 py-1.5">
                      🥑 {selectedItem.fats} fats
                    </span>
                  </div>
                </div>

                {/* Simulated payment button */}
                <div className="pt-4 border-t border-white/[0.08] mt-3">
                  <button
                    onClick={() => submitSingleItemOrder(selectedItem)}
                    disabled={isProcessingPay}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-500 to-orange-500 hover:from-brand-600 hover:to-orange-600 text-white font-bold text-xs shadow-lg shadow-brand-500/25 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 animate-pulse-soft"
                  >
                    {isProcessingPay ? (
                      <span className="flex items-center gap-1.5">
                        <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                        Processing MoMo...
                      </span>
                    ) : (
                      <>
                        <span>Simulate MoMo Payment</span>
                        <CreditCard className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* MERCHANT LIVE ORDERS MONITOR PANEL (The simulated dashboard queue) */}
      <section className="relative z-10 py-12 bg-surface-950/60 border-y border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
            <span className="text-xs text-brand-400 font-extrabold uppercase tracking-widest bg-brand-500/10 border border-brand-500/20 px-3 py-1 rounded-full">
              Real-Time Synchronized Systems
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Merchant Live Orders Panel
            </h2>
            <p className="text-surface-400 text-xs sm:text-sm">
              Watch orders sync in real-time. Hear audio alerts, manage statuses, and watch webhook splits handle settlements.
            </p>
          </div>

          {/* Tablet Mockup Frame */}
          <div className="w-full max-w-4xl h-[520px] rounded-[32px] border-[10px] border-[#2C2621] bg-[#120F0D]/65 backdrop-blur-[24px] border border-white/[0.08] relative shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1.5px_rgba(255,255,255,0.15)] overflow-hidden flex flex-col z-10">
            {/* Tablet Header */}
            <div className="bg-[#1C1816]/70 backdrop-blur-md px-6 py-4 border-b border-white/[0.08] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500"></span>
                </span>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Live Orders Queue</h4>
              </div>
              
              <div className="flex items-center gap-2 text-[10px] font-bold text-brand-400 bg-brand-500/10 px-3 py-1.5 rounded-full border border-brand-500/15">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Audio Alert Enabled</span>
              </div>
            </div>

            {/* Orders Scroll Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 scrollbar-thin bg-gradient-to-b from-[#141210]/60 to-[#0D0B0A]/60">
              {orders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Bell className="w-10 h-10 text-surface-600 mb-2 animate-bounce" />
                  <p className="text-xs text-surface-400 font-bold">Waiting for orders from the mockups above...</p>
                  <p className="text-[10px] text-surface-500 max-w-sm mt-1">
                    Interact with Screen 2 or Screen 3, click Place Order, and watch them queue up instantly!
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white/[0.03] backdrop-blur-md border border-white/[0.06] hover:border-brand-500/30 rounded-2xl p-4 transition-all relative overflow-hidden flex flex-col justify-between"
                    >
                      {/* Header row */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-xs font-black text-brand-400">
                            {order.orderNumber.replace('DI-', '#')}
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-white">{order.customerName}</h5>
                            <p className="text-[9px] text-surface-500">{order.time}</p>
                          </div>
                        </div>

                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                          order.status === 'pending'
                            ? 'bg-brand-500/10 text-brand-400 border-brand-500/20'
                            : order.status === 'cooking'
                            ? 'bg-warning-500/10 text-warning-400 border-warning-500/20'
                            : order.status === 'ready'
                            ? 'bg-info-500/10 text-info-400 border-info-500/20'
                            : 'bg-success-500/10 text-success-400 border-success-500/20'
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      {/* Items details */}
                      <div className="text-[11px] text-surface-400 py-3 space-y-1 font-medium">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{it.quantity}x {it.name}</span>
                            <span>GH₵ {(it.price * it.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="border-t border-white/5 pt-2 flex justify-between font-bold text-white">
                          <span>Delivery Fee (Zone)</span>
                          <span>GH₵ 15.00</span>
                        </div>
                        <div className="flex justify-between font-black text-brand-400 text-xs pt-1">
                          <span>Total Payout</span>
                          <span>GH₵ {order.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Order status state transition controls */}
                      <div className="pt-3 border-t border-white/5 flex gap-2 justify-end">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'cooking')}
                            className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-[10px] transition-colors cursor-pointer"
                          >
                            Accept & Cook
                          </button>
                        )}
                        {order.status === 'cooking' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'ready')}
                            className="px-3 py-1.5 rounded-lg bg-warning-500 hover:bg-warning-600 text-white font-bold text-[10px] transition-colors cursor-pointer"
                          >
                            Mark Ready
                          </button>
                        )}
                        {order.status === 'ready' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                            className="px-3 py-1.5 rounded-lg bg-success-500 hover:bg-success-600 text-white font-bold text-[10px] transition-colors cursor-pointer"
                          >
                            Dispatch
                          </button>
                        )}
                        {order.status === 'delivered' && (
                          <span className="text-[10px] text-success-500 font-extrabold flex items-center gap-1">
                            ✓ Out for Delivery / Settled
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Features Grid (Frosted Glass Cards) */}
      <section className="relative z-10 py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h2 className="text-3xl font-black text-white tracking-tight sm:text-4xl">
            Everything your food business needs
          </h2>
          <p className="text-surface-400 text-sm sm:text-base">
            Built from scratch to fit the local Ghanaian meal-prep and restaurant delivery market.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: QrCode,
              title: 'Dynamic QR Codes',
              desc: 'Generate posters and flyers with color palettes mapped directly from your tenant brand colors.',
            },
            {
              icon: Smartphone,
              title: 'Mobile Money Ready',
              desc: 'Accept MTN MoMo, Telecel Cash, and AT Money directly inside client storefronts with instant webhook syncing.',
            },
            {
              icon: CreditCard,
              title: 'Paystack Automated Splits',
              desc: 'Configure settlement subaccounts to route storefront funds automatically, skipping manual withdrawals.',
            },
            {
              icon: ShoppingBag,
              title: 'Unified Live Orders',
              desc: 'Real-time orders queue with audio alerts and order stage state machines (Cooking ➔ Ready ➔ Dispatched).',
            },
            {
              icon: BarChart3,
              title: 'Sales & Client Files',
              desc: 'Audit repeat customer expenditures and view 7-day sales reports with native CSS charts.',
            },
            {
              icon: Zap,
              title: 'Auto-SMS Notifications',
              desc: 'Keep clients in the loop with automated order confirmations and dispatch messages via Arkesel SMS integration.',
            },
          ].map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="bg-white/[0.03] backdrop-blur-md border border-white/[0.05] hover:border-brand-500/30 hover:bg-white/[0.06] rounded-3xl p-6 transition-all duration-300 group hover:translate-y-[-2px] relative shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-brand-400" />
                </div>
                <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                <p className="text-sm text-surface-400 mt-2 leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing / Commission section */}
      <section className="relative z-10 py-20 bg-surface-950 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto bg-gradient-to-br from-[#1C1816] to-[#0D0B0A] border border-white/[0.07] rounded-[32px] p-8 text-center relative shadow-2xl overflow-hidden shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.12)]">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-brand-500/10 blur-xl pointer-events-none" />
            <span className="text-xs font-extrabold uppercase tracking-widest text-brand-400 bg-brand-500/10 border border-brand-500/20 px-3 py-1 rounded-full">
              PAY-AS-YOU-EARN
            </span>
            <h3 className="text-2xl font-black text-white mt-6">Simple Pricing</h3>
            
            <div className="my-8">
              <span className="text-6xl font-black text-white bg-gradient-to-r from-brand-400 to-orange-500 bg-clip-text text-transparent">2%</span>
              <span className="text-surface-400 block text-xs mt-2 font-bold tracking-wider uppercase">per transaction</span>
            </div>
            
            <p className="text-sm text-surface-400 leading-relaxed">
              No monthly subscription fees. No setup charges. Get access to unlimited orders, categories, and SMS notifications with Didi.
            </p>

            <div className="my-8 border-t border-white/5 pt-6 space-y-3.5 text-left text-xs text-surface-300 font-medium max-w-[280px] mx-auto font-semibold">
              {[
                'Unlimited Menus & Items',
                'Branded Storefront & Logo Cache',
                'Real-Time Orders Audio Alerts',
                'Custom Neighborhood Delivery Zones',
                'Automated Paystack Bank Split',
                'Arkesel SMS Updates Included',
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <Link
              href="/register"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-orange-500 text-white font-bold text-base hover:from-brand-600 hover:to-orange-600 transition-all active:scale-[0.98] shadow-lg shadow-brand-500/15"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-[#0D0B0A] text-surface-500 border-t border-white/[0.06] py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 rounded-lg overflow-hidden border border-white/10 shadow">
              <Image
                src="/images/didi_logo.png"
                alt="Didi Logo"
                fill
                sizes="24px"
                className="object-cover"
              />
            </div>
            <span className="text-xl font-bold text-white tracking-widest">Didi</span>
          </div>
          <p className="text-xs font-semibold">
            © {new Date().getFullYear()} Didi Food OS. All rights reserved. Built with love in Ghana 🇬🇭.
          </p>
        </div>
      </footer>
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  ArrowRight,
  Search,
  Users,
  ShieldCheck,
  Package,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import heroFarmImage from '../assets/images/agrilink_hero_1788269634549.jpg';

export const LandingPage = () => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  const steps = [
    {
      num: '01',
      title: 'Discover',
      description: 'Find the produce you need from available listings.',
      icon: Search,
      badge: 'Live Marketplace',
      tagline: 'Real-time commodity availability'
    },
    {
      num: '02',
      title: 'Connect',
      description: 'Connect buyers with farmers directly.',
      icon: Users,
      badge: 'Direct Negotiation',
      tagline: 'No intermediaries, transparent prices'
    },
    {
      num: '03',
      title: 'Trade',
      description: 'Request, manage, and complete orders through the platform.',
      icon: Package,
      badge: 'Secure Orders',
      tagline: 'Integrated fulfillment and tracking'
    },
  ];

  const features = [
    {
      title: 'Direct Connections',
      description: 'Connect buyers directly with farmers.',
      icon: Users,
      accentColor: 'text-[#0057b8]',
      accentBg: 'bg-blue-50/80',
      borderHover: 'hover:border-blue-200',
      gradientFrom: 'from-blue-50/40',
    },
    {
      title: 'Smart Discovery',
      description: 'Find produce based on what you need.',
      icon: Search,
      accentColor: 'text-[#15803d]',
      accentBg: 'bg-emerald-50/80',
      borderHover: 'hover:border-emerald-200',
      gradientFrom: 'from-emerald-50/40',
    },
    {
      title: 'Simple Orders',
      description: 'Manage requests and orders in one place.',
      icon: Package,
      accentColor: 'text-[#0057b8]',
      accentBg: 'bg-blue-50/80',
      borderHover: 'hover:border-blue-200',
      gradientFrom: 'from-blue-50/40',
    },
    {
      title: 'Smarter Matching',
      description: 'Connect the right buyers with the right farmers.',
      icon: Sparkles,
      accentColor: 'text-[#15803d]',
      accentBg: 'bg-emerald-50/80',
      borderHover: 'hover:border-emerald-200',
      gradientFrom: 'from-emerald-50/40',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-body selection:bg-emerald-100 selection:text-emerald-900 flex flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1">
        {/* ========================================================= */}
        {/* SECTION 1 — HERO                                          */}
        {/* ========================================================= */}
        <section className="relative pt-24 pb-14 sm:pt-36 sm:pb-24 lg:pt-44 lg:pb-32 overflow-hidden bg-white">
          {/* Multi-layer subtle ambient background */}
          <div className="absolute top-0 right-0 w-[min(550px,100%)] lg:w-[750px] h-[550px] lg:h-[750px] bg-[#15803d]/[0.035] rounded-full blur-[130px] pointer-events-none -translate-y-1/3" />
          <div className="absolute top-1/3 left-0 w-[min(450px,100%)] lg:w-[650px] h-[450px] lg:h-[650px] bg-[#0057b8]/[0.035] rounded-full blur-[130px] pointer-events-none" />
          
          {/* Subtle micro-dot pattern for technological depth */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.25]"
            style={{
              backgroundImage: 'radial-gradient(circle, #64748b 1px, transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          />
          {/* Smooth bottom fade out */}
          <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-16 items-center">
              
              {/* Left Column: Hero Content */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="lg:col-span-6 text-center lg:text-left space-y-5 sm:space-y-7 min-w-0 w-full"
              >
                {/* 1. Small supporting text (Pill badge) */}
                <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-700 tracking-wide shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse" />
                  <span>Agricultural Technology Platform</span>
                </motion.div>

                {/* 2. Large primary heading with clamp typography */}
                <motion.h1
                  variants={itemVariants}
                  className="text-[1.65rem] min-[360px]:text-3xl min-[410px]:text-4xl sm:text-5xl lg:text-[3.85rem] xl:text-[4.25rem] font-sans font-extrabold tracking-tight text-slate-950 leading-[1.15] sm:leading-[1.08] break-words"
                >
                  A smarter way to connect{' '}
                  <span className="relative inline-block whitespace-nowrap">
                    <span className="relative z-10 text-[#15803d]">farmers</span>
                    <span className="absolute bottom-1 sm:bottom-1.5 left-0 right-0 h-2 sm:h-2.5 bg-[#15803d]/12 rounded-full -z-0" />
                  </span>{' '}
                  with{' '}
                  <span className="relative inline-block whitespace-nowrap">
                    <span className="relative z-10 text-[#0057b8]">buyers.</span>
                    <span className="absolute bottom-1 sm:bottom-1.5 left-0 right-0 h-2 sm:h-2.5 bg-[#0057b8]/12 rounded-full -z-0" />
                  </span>
                </motion.h1>

                {/* 3. Existing supporting description with comfortable reading max-width */}
                <motion.p
                  variants={itemVariants}
                  className="text-base sm:text-lg lg:text-xl text-slate-600 font-normal leading-relaxed max-w-xl mx-auto lg:mx-0"
                >
                  AgroLink makes it easier to discover fresh produce, connect directly with farmers, and manage orders from one simple platform.
                </motion.p>

                {/* 4. Existing CTA buttons */}
                <motion.div
                  variants={itemVariants}
                  className="pt-1 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 sm:gap-4"
                >
                  <Link
                    to="/register"
                    state={{ role: 'Buyer' }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 min-h-[48px] rounded-full text-[15px] font-bold bg-[#0057b8] hover:bg-[#004799] text-white transition-all duration-200 shadow-[0_4px_16px_rgba(0,87,184,0.25)] hover:shadow-[0_8px_24px_rgba(0,87,184,0.35)] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057b8]/50"
                  >
                    <span>Find Produce</span>
                    <ArrowRight size={17} />
                  </Link>

                  <Link
                    to="/register"
                    state={{ role: 'Farmer' }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 min-h-[48px] rounded-full text-[15px] font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 hover:border-slate-300 transition-all duration-200 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    <span>Sell Produce</span>
                  </Link>
                </motion.div>

                {/* Trust Indicators */}
                <motion.div
                  variants={itemVariants}
                  className="pt-3 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 sm:gap-x-7 gap-y-2.5 text-[13px] text-slate-500 font-semibold"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-[#15803d] shrink-0" /> Verified Nigerian Farms
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-[#0057b8] shrink-0" /> Direct Farm Sourcing
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-[#15803d] shrink-0" /> Integrated Logistics
                  </span>
                </motion.div>
              </motion.div>

              {/* Right Column: Premium Visual Mockup with Photography Integration */}
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
                className="lg:col-span-6 relative"
              >
                <div className="relative mx-auto max-w-lg lg:max-w-none">
                  {/* Subtle ambient blur backlight */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#0057b8]/10 via-transparent to-[#15803d]/10 blur-2xl scale-105 pointer-events-none" />

                  {/* Browser Shell Frame */}
                  <div className="relative rounded-3xl bg-white border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden">
                    
                    {/* Browser chrome header bar */}
                    <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#f87171]" />
                          <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                          <span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" />
                        </div>
                        <div className="ml-2 hidden xs:flex min-[380px]:flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-white border border-slate-200/80 rounded-full shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
                          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">agrolink.ng/marketplace</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#15803d] border border-emerald-200/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] animate-pulse" />
                        Live
                      </span>
                    </div>

                    {/* Integrated Authentic Agricultural Photography Banner */}
                    <div className="relative h-32 sm:h-44 w-full overflow-hidden">
                      <img
                        src={heroFarmImage}
                        alt="Nigerian commercial farmers harvesting produce with modern digital tools"
                        className="w-full h-full object-cover object-center"
                        loading="eager"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
                      <div className="absolute bottom-2.5 sm:bottom-3 left-3 sm:left-5 right-3 flex items-end justify-between">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold bg-white/90 backdrop-blur-md text-slate-800 border border-white/60 shadow-xs">
                          Direct Sourcing Pipeline
                        </span>
                      </div>
                    </div>

                    {/* Visual Body Content: Live Marketplace Listings */}
                    <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-3.5 bg-white">
                      
                      {/* Featured Listing 1 */}
                      <div className="p-2.5 sm:p-4 rounded-2xl border border-slate-150 bg-slate-50/70 hover:bg-white hover:border-slate-300/80 hover:shadow-sm transition-all duration-200 flex gap-2.5 sm:gap-3.5 items-center">
                        <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-xl bg-emerald-50/80 flex items-center justify-center shrink-0 text-xl sm:text-2xl border border-emerald-100 shadow-2xs">
                          🌽
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">Premium White Maize</h4>
                            <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100/90 text-emerald-800">
                              In Stock
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-slate-500 truncate">Musa Ibrahim • Green Harvest, Kano</p>
                          <div className="flex items-center gap-1.5 sm:gap-2.5 mt-0.5 sm:mt-1 text-[11px] sm:text-xs font-semibold">
                            <span className="text-slate-900 font-bold">₦650 / kg</span>
                            <span className="text-slate-300" aria-hidden="true">|</span>
                            <span className="text-slate-500 font-medium">5,000 kg</span>
                          </div>
                        </div>
                        <Link
                          to="/register"
                          state={{ role: 'Buyer' }}
                          className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 min-h-[32px] sm:min-h-[36px] rounded-xl text-[11px] sm:text-xs font-bold bg-[#0057b8] hover:bg-[#004799] text-white transition-colors shrink-0 shadow-2xs flex items-center justify-center"
                        >
                          Request
                        </Link>
                      </div>

                      {/* Secondary Listing Preview */}
                      <div className="p-2.5 sm:p-4 rounded-2xl border border-slate-150 bg-slate-50/70 hover:bg-white hover:border-slate-300/80 hover:shadow-sm transition-all duration-200 flex gap-2.5 sm:gap-3.5 items-center">
                        <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-xl bg-amber-50/80 flex items-center justify-center shrink-0 text-xl sm:text-2xl border border-amber-100 shadow-2xs">
                          🥔
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">Fresh Yam Tubers</h4>
                            <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100/90 text-emerald-800">
                              In Stock
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-slate-500 truncate">Grace Danladi • Sunrise Farm, Benue</p>
                          <div className="flex items-center gap-1.5 sm:gap-2.5 mt-0.5 sm:mt-1 text-[11px] sm:text-xs font-semibold">
                            <span className="text-slate-900 font-bold">₦1,200 / tuber</span>
                            <span className="text-slate-300" aria-hidden="true">|</span>
                            <span className="text-slate-500 font-medium">1,200 units</span>
                          </div>
                        </div>
                        <Link
                          to="/register"
                          state={{ role: 'Buyer' }}
                          className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 min-h-[32px] sm:min-h-[36px] rounded-xl text-[11px] sm:text-xs font-bold bg-[#0057b8] hover:bg-[#004799] text-white transition-colors shrink-0 shadow-2xs flex items-center justify-center"
                        >
                          Request
                        </Link>
                      </div>

                      {/* Smart Match Strip */}
                      <div className="p-3 sm:p-4 rounded-2xl bg-slate-950 text-white flex flex-col min-[380px]:flex-row items-start min-[380px]:items-center justify-between gap-2.5 sm:gap-3 shadow-md">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Sparkles size={13} className="text-emerald-400 shrink-0" />
                            <span className="text-[9px] sm:text-[10px] font-bold tracking-widest uppercase text-slate-400">Smart Match Algorithm</span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-200 font-medium">96% proximity match in Kano</p>
                        </div>
                        <span className="px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap self-end min-[380px]:self-auto">
                          Instant Route
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* Mobile In-Flow Statistics Grid (Visible on mobile < sm, hidden on desktop >= sm) */}
                  <div className="grid grid-cols-2 gap-2.5 mt-3 sm:hidden">
                    <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#15803d] flex items-center justify-center shrink-0 border border-emerald-100/90">
                        <TrendingUp size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">Market Volume</p>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-950 truncate">₦85.4M+ Traded</p>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0057b8] flex items-center justify-center shrink-0 border border-blue-100/90">
                        <ShieldCheck size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">Verified Sellers</p>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-950 truncate">1,240+ Farmers</p>
                      </div>
                    </div>
                  </div>

                  {/* Floating Metric Badge 1: Market Volume (Desktop only >= sm) */}
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -bottom-5 -left-5 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/90 shadow-[0_12px_28px_rgba(15,23,42,0.09)] hidden sm:flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#15803d] flex items-center justify-center shrink-0 border border-emerald-100/90">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Market Volume</p>
                      <p className="text-[15px] font-extrabold text-slate-950">₦85.4M+ Traded</p>
                    </div>
                  </motion.div>

                  {/* Floating Metric Badge 2: Verified Sellers (Desktop only >= sm) */}
                  <motion.div
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                    className="absolute -top-5 -right-5 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/90 shadow-[0_12px_28px_rgba(15,23,42,0.09)] hidden sm:flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0057b8] flex items-center justify-center shrink-0 border border-blue-100/90">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verified Sellers</p>
                      <p className="text-[15px] font-extrabold text-slate-950">1,240+ Active Farmers</p>
                    </div>
                  </motion.div>

                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 2 — HOW AGROLINK WORKS                            */}
        {/* ========================================================= */}
        <section id="how-it-works" className="py-16 sm:py-24 lg:py-28 bg-[#f8fafc] relative overflow-hidden border-y border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="text-center max-w-3xl mx-auto mb-12 sm:mb-20 space-y-3 sm:space-y-3.5"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0057b8]/8 border border-[#0057b8]/15 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0057b8]">
                Simple 3-Step Process
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-sans font-extrabold text-slate-950 tracking-tight">
                How AgroLink Works
              </h2>
              <p className="text-base sm:text-lg text-slate-600 font-normal max-w-xl mx-auto leading-relaxed">
                Designed to make agricultural trade transparent, dependable, and efficient from initial discovery to final delivery.
              </p>
            </motion.div>

            {/* 3-Step Flow */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-8 relative">
              
              {/* Connecting Desktop Track Line */}
              <div className="hidden md:block absolute top-[52px] left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-[1px] bg-gradient-to-r from-transparent via-slate-300/80 to-transparent pointer-events-none z-0" aria-hidden="true" />

              {steps.map((step, idx) => {
                const StepIcon = step.icon;
                return (
                  <motion.div
                    key={step.num}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.45, delay: idx * 0.12, ease: 'easeOut' }}
                    whileHover={{ y: -4 }}
                    className="relative z-10 bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-8 border border-slate-200/90 shadow-[0_2px_16px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.07)] transition-all duration-200 flex flex-col"
                  >
                    {/* Step Number + Icon Row */}
                    <div className="flex items-center justify-between mb-5 sm:mb-7">
                      <span className="text-3xl sm:text-5xl font-mono font-bold text-slate-200/90 leading-none select-none">
                        {step.num}
                      </span>
                      <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-[#0057b8] shadow-2xs">
                        <StepIcon size={22} />
                      </div>
                    </div>

                    {/* Step Title & Description */}
                    <h3 className="text-xl sm:text-2xl font-sans font-extrabold text-slate-950 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-[14px] sm:text-[15px] text-slate-600 leading-relaxed mb-auto">
                      {step.description}
                    </p>

                    <div className="mt-6 sm:mt-8 pt-4 sm:pt-5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">{step.badge}</span>
                      <span className="text-xs sm:text-[13px] font-bold text-[#15803d] flex items-center gap-1">
                        Explore <ChevronRight size={14} />
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 3 — THE AGROLINK ADVANTAGE                        */}
        {/* ========================================================= */}
        <section className="py-16 sm:py-24 lg:py-28 bg-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="text-center max-w-3xl mx-auto mb-12 sm:mb-20 space-y-3 sm:space-y-3.5"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#15803d]/8 border border-[#15803d]/15 text-[11px] font-bold uppercase tracking-[0.14em] text-[#15803d]">
                The AgroLink Advantage
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-sans font-extrabold text-slate-950 tracking-tight">
                Everything you need to trade smarter.
              </h2>
              <p className="text-base sm:text-lg text-slate-600 font-normal max-w-xl mx-auto leading-relaxed">
                Purpose-built tools for buyers seeking reliable agricultural supply and farmers ready to scale their commercial revenue.
              </p>
            </motion.div>

            {/* 4 Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {features.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.45, delay: idx * 0.08, ease: 'easeOut' }}
                    whileHover={{ y: -5 }}
                    className={`relative p-5 sm:p-7 lg:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white overflow-hidden transition-all duration-200 shadow-2xs hover:shadow-xl ${card.borderHover} flex flex-col group`}
                  >
                    {/* Subtle gradient fill on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.gradientFrom} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />

                    <div className="relative z-10">
                      {/* Icon */}
                      <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-2xl ${card.accentBg} ${card.accentColor} flex items-center justify-center mb-5 sm:mb-6 transition-transform duration-200 group-hover:scale-105 border border-slate-200/60 shadow-2xs`}>
                        <Icon size={22} />
                      </div>

                      {/* Title */}
                      <h3 className="text-lg sm:text-xl font-sans font-extrabold text-slate-950 mb-2">
                        {card.title}
                      </h3>

                      {/* Description */}
                      <p className="text-[14px] sm:text-[15px] text-slate-600 leading-relaxed">
                        {card.description}
                      </p>
                    </div>

                    <div className="relative z-10 mt-6 sm:mt-8 pt-4 sm:pt-5 border-t border-slate-100 flex items-center text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Powered by AgroLink</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Conversion Banner */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="mt-12 sm:mt-20 relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Deep obsidian backdrop with ambient accents */}
              <div className="absolute inset-0 bg-[#060e1b]" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#0057b8]/35 via-[#060e1b] to-[#15803d]/25" />
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              <div className="relative z-10 p-6 sm:p-12 lg:p-16 text-white flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
                <div className="space-y-2.5 sm:space-y-3 text-center md:text-left max-w-xl">
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-sans font-extrabold leading-tight">
                    Ready to modernize your agricultural sourcing?
                  </h3>
                  <p className="text-sm sm:text-base text-blue-100/80 font-normal leading-relaxed">
                    Join hundreds of food processors, wholesalers, and verified commercial farmers already trading on AgroLink.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                  <Link
                    to="/register"
                    className="w-full sm:w-auto px-7 py-3.5 min-h-[48px] rounded-full text-[15px] font-bold bg-white text-[#0057b8] hover:bg-slate-100 transition-all duration-200 text-center shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center"
                  >
                    Get Started Free
                  </Link>
                  <Link
                    to="/login"
                    className="w-full sm:w-auto px-7 py-3.5 min-h-[48px] rounded-full text-[15px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all duration-200 text-center flex items-center justify-center"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </motion.div>

          </div>
        </section>
      </main>

      {/* ========================================================= */}
      {/* SECTION 4 — FOOTER                                        */}
      {/* ========================================================= */}
      <Footer />
    </div>
  );
};

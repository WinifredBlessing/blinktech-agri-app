import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { Menu, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'About', href: '#about' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'py-3.5 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_4px_24px_rgba(15,23,42,0.04)]'
          : 'py-5 sm:py-6 bg-white/70 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 flex justify-between items-center w-full gap-2">
        {/* Brand Logo with confident presence */}
        <Logo size="lg" />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-2">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-[14px] font-semibold text-slate-600 hover:text-slate-950 px-3.5 py-2 rounded-lg hover:bg-slate-100/70 transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-200/90" aria-hidden="true" />

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-[14px] font-semibold text-slate-700 hover:text-[#0057b8] px-4 py-2 rounded-lg hover:bg-slate-100/60 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-full text-[14px] font-bold bg-[#0057b8] hover:bg-[#004799] text-white shadow-[0_2px_10px_rgba(0,87,184,0.22)] hover:shadow-[0_4px_18px_rgba(0,87,184,0.32)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057b8]/40"
            >
              <span>Get Started</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </nav>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-1.5 sm:gap-2 shrink-0">
          <Link
            to="/login"
            className="text-xs font-bold text-slate-700 hover:text-[#0057b8] px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-slate-100 whitespace-nowrap"
          >
            Sign In
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-700 hover:text-slate-950 rounded-xl hover:bg-slate-100/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057b8]/30 shrink-0"
            aria-label="Toggle Menu"
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden bg-white/95 backdrop-blur-2xl border-b border-slate-200/90 shadow-xl px-4 sm:px-6 py-5 overflow-y-auto max-h-[calc(100vh-4.5rem)]"
          >
            <nav className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-3 text-[15px] font-semibold text-slate-800 hover:bg-slate-50 hover:text-[#0057b8] rounded-xl transition-colors"
                >
                  {link.name}
                </a>
              ))}
              <div className="h-px bg-slate-100 my-2" />
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="px-4 py-3 text-[15px] font-semibold text-slate-800 hover:bg-slate-50 hover:text-[#0057b8] rounded-xl transition-colors"
              >
                Sign In to Account
              </Link>
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-5 py-3.5 min-h-[48px] rounded-xl text-[15px] font-bold bg-[#0057b8] hover:bg-[#004799] text-white shadow-md active:scale-[0.99] transition-all"
              >
                <span>Get Started Now</span>
                <ArrowRight size={17} />
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

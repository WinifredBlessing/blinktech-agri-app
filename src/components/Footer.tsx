import React from 'react';
import { Logo } from './Logo';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer id="about" className="bg-[#050910] text-white pt-20 sm:pt-24 pb-12 relative overflow-hidden font-body border-t border-slate-900">
      {/* Subtle ambient light accents */}
      <div className="absolute top-0 right-0 w-[min(450px,100%)] h-[450px] bg-[#15803d]/[0.08] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[min(450px,100%)] h-[450px] bg-[#0057b8]/[0.08] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 subtle-grid-bg opacity-[0.07] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-16 pb-14 border-b border-slate-800/80">
          
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-5">
            <Logo variant="dark" size="lg" />
            <p className="text-[17px] text-slate-200 font-semibold max-w-sm pt-1">
              Connecting farms to opportunity.
            </p>
            <p className="text-[14px] text-slate-400 max-w-md leading-relaxed font-normal">
              Empowering farmers and high-volume commercial buyers across Nigeria with transparent direct trading, verified producer networks, and integrated logistics.
            </p>
          </div>

          {/* Platform Column */}
          <div className="md:col-span-2 sm:col-span-4">
            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-5">
              Platform
            </h5>
            <ul className="space-y-3.5 text-[14px] text-slate-300 font-medium">
              <li>
                <Link to="/buyer-dashboard" className="hover:text-white hover:translate-x-0.5 inline-block transition-all duration-200">
                  Find Produce
                </Link>
              </li>
              <li>
                <Link to="/farmer-dashboard" className="hover:text-white hover:translate-x-0.5 inline-block transition-all duration-200">
                  Sell Produce
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white hover:translate-x-0.5 inline-block transition-all duration-200">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#about" className="hover:text-white hover:translate-x-0.5 inline-block transition-all duration-200">
                  About AgroLink
                </a>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div className="md:col-span-2 sm:col-span-4">
            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-5">
              Support
            </h5>
            <ul className="space-y-3.5 text-[14px] text-slate-300 font-medium">
              <li>
                <a href="mailto:support@agrolink.ng" className="hover:text-white hover:translate-x-0.5 inline-block transition-all duration-200">
                  Help Center
                </a>
              </li>
              <li>
                <a href="mailto:contact@agrolink.ng" className="hover:text-white hover:translate-x-0.5 inline-block transition-all duration-200">
                  Contact
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white hover:translate-x-0.5 inline-block transition-all duration-200">
                  FAQs
                </a>
              </li>
            </ul>
          </div>

          {/* Account Column */}
          <div className="md:col-span-3 sm:col-span-4">
            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-5">
              Account
            </h5>
            <ul className="space-y-3.5 text-[14px] text-slate-300 font-medium">
              <li>
                <Link to="/login" className="hover:text-white hover:translate-x-0.5 inline-block transition-all duration-200">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white hover:translate-x-0.5 inline-block transition-all duration-200">
                  Create Account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-slate-500 font-medium">
          <p>© 2026 AgroLink. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            <span className="hover:text-slate-300 transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-300 transition-colors cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-300 transition-colors cursor-pointer">Security</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

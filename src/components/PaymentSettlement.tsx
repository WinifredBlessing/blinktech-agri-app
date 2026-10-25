/**
 * PaymentSettlement.tsx
 *
 * Payment & Settlement section for the Farmer Profile page.
 *
 * Allows an authenticated farmer to:
 *   1. View their current verified payout bank account (masked display)
 *   2. Add a new Nigerian bank account (verified via Paystack through secure Edge Function)
 *   3. Edit / replace an existing bank account (requires Paystack re-verification)
 *   4. Search Nigerian banks with a searchable dropdown
 *   5. Retry loading banks if network or service error occurs
 *
 * Security:
 *   - Uses the deployed `verify-farmer-bank-account` Supabase Edge Function
 *   - The Paystack Secret Key is NEVER exposed in frontend code or requests
 *   - Raw account numbers are NEVER stored in public tables or persisted locally
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Landmark,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ShieldCheck,
  ChevronDown,
  CreditCard,
  Search,
  RefreshCw,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  fetchMyPayoutAccount,
  fetchBankList,
  verifyBankAccount,
  savePayoutAccount,
  type FarmerPayoutAccount,
  type PaystackBank,
} from '../services/payoutService';
import { isSupabaseConfigured } from '../services/supabaseClient';

// ---------------------------------------------------------------------------
// Types for local UI state
// ---------------------------------------------------------------------------

type FormStep = 'idle' | 'form' | 'verifying' | 'confirmed' | 'saving';

interface FormState {
  bankCode: string;
  bankName: string;
  accountNumber: string;
}

// ---------------------------------------------------------------------------
// Skeleton loader shown while data fetches on mount
// ---------------------------------------------------------------------------
const SkeletonCard = () => (
  <div className="animate-pulse space-y-3">
    <div className="h-4 bg-slate-100 rounded-lg w-1/3" />
    <div className="h-10 bg-slate-100 rounded-xl w-full" />
  </div>
);

// ---------------------------------------------------------------------------
// Section header (shared between all states)
// ---------------------------------------------------------------------------
const SectionHeader = () => (
  <div className="flex items-start gap-3">
    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
      <Landmark size={17} className="text-[#15803d]" />
    </div>
    <div>
      <h3 className="text-base font-sans font-bold text-slate-900">Payment &amp; Settlement</h3>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
        Add a verified Nigerian bank account to receive your earnings from successful sales on AgroLink.
      </p>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const PaymentSettlement: React.FC = () => {
  // ── Data state ────────────────────────────────────────────────────────────
  const [account, setAccount] = useState<FarmerPayoutAccount | null>(null);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [banksError, setBanksError] = useState('');

  // ── Modal / form state ────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<FormStep>('idle');
  const [form, setForm] = useState<FormState>({
    bankCode: '',
    bankName: '',
    accountNumber: '',
  });
  const [verifiedName, setVerifiedName] = useState('');
  const [verifiedMasked, setVerifiedMasked] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [saveError, setSaveError] = useState('');

  // ── Searchable dropdown state ─────────────────────────────────────────────
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Close dropdown when clicking outside ──────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isDropdownOpen]);

  // ── Load existing account on mount ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingAccount(true);
      try {
        const existing = await fetchMyPayoutAccount();
        if (!cancelled) setAccount(existing);
      } catch {
        // Silently handle — no account shown
      } finally {
        if (!cancelled) setLoadingAccount(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Fetch banks with retry support ────────────────────────────────────────
  const loadBanks = useCallback(async () => {
    setLoadingBanks(true);
    setBanksError('');
    try {
      const list = await fetchBankList();
      setBanks(list);
    } catch (err: any) {
      setBanksError(err?.message || 'Failed to load Nigerian banks. Please try again.');
    } finally {
      setLoadingBanks(false);
    }
  }, []);

  // ── Open modal ────────────────────────────────────────────────────────────
  const openModal = useCallback(async () => {
    setShowModal(true);
    setStep('form');
    setForm({ bankCode: '', bankName: '', accountNumber: '' });
    setVerifiedName('');
    setVerifiedMasked('');
    setVerifyError('');
    setSaveError('');
    setSearchQuery('');
    setIsDropdownOpen(false);

    if (banks.length === 0) {
      await loadBanks();
    }
  }, [banks.length, loadBanks]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setStep('idle');
    setVerifyError('');
    setSaveError('');
    setIsDropdownOpen(false);
  }, []);

  // ── Bank selection ────────────────────────────────────────────────────────
  const handleSelectBank = (selectedBank: PaystackBank) => {
    setForm((f) => ({
      ...f,
      bankCode: selectedBank.code,
      bankName: selectedBank.name,
    }));
    setIsDropdownOpen(false);
    setSearchQuery('');
    setVerifyError('');
    // Reset previous verification when bank changes
    setVerifiedName('');
    setVerifiedMasked('');
    if (step === 'confirmed') setStep('form');
  };

  // ── Account number change ─────────────────────────────────────────────────
  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strictly numeric, maximum 10 digits
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm((f) => ({ ...f, accountNumber: val }));
    setVerifyError('');
    // Reset verification if user modifies account number
    if (verifiedName) {
      setVerifiedName('');
      setVerifiedMasked('');
      if (step === 'confirmed') setStep('form');
    }
  };

  // ── Filtered banks for searchable dropdown ────────────────────────────────
  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  // ── Verify account via Edge Function ──────────────────────────────────────
  const handleVerify = async () => {
    setVerifyError('');

    // Frontend validation for immediate feedback
    if (!form.bankCode) {
      setVerifyError('Please select a bank from the list.');
      return;
    }
    if (!form.accountNumber || form.accountNumber.length !== 10) {
      setVerifyError('Please enter a valid 10-digit Nigerian NUBAN account number.');
      return;
    }

    setStep('verifying');
    try {
      const result = await verifyBankAccount(form.bankCode, form.accountNumber);
      if (result.success && result.accountName) {
        setVerifiedName(result.accountName);
        setVerifiedMasked(result.maskedAccountNumber || `****${form.accountNumber.slice(-4)}`);
        setStep('confirmed');
      } else {
        setVerifyError(
          result.error ||
            "We couldn't verify this bank account. Please check your bank and account number and try again."
        );
        setStep('form');
      }
    } catch (err: any) {
      setVerifyError(
        err?.message ||
          "We couldn't verify this bank account. Please check your connection and try again."
      );
      setStep('form');
    }
  };

  // ── Save confirmed payout account ─────────────────────────────────────────
  const handleSave = async () => {
    setSaveError('');
    setStep('saving');
    try {
      const saved = await savePayoutAccount({
        bankCode: form.bankCode,
        bankName: form.bankName,
        accountName: verifiedName,
        maskedAccountNumber: verifiedMasked,
      });
      setAccount(saved);
      closeModal();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save payout account. Please try again.');
      setStep('confirmed');
    }
  };

  const isBusy = step === 'verifying' || step === 'saving';

  // ── Fallback if Supabase is unconfigured ──────────────────────────────────
  if (!isSupabaseConfigured) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8">
        <SectionHeader />
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-500" />
          <span>
            Supabase is not configured. Payment &amp; Settlement requires a live Supabase connection.
          </span>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-8">
        <SectionHeader />

        <div className="mt-5">
          {loadingAccount ? (
            <SkeletonCard />
          ) : account ? (
            // ─── Verified existing account card ─────────────────────────────
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                  <Landmark size={18} className="text-[#15803d]" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900">{account.bankName}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-200 text-[#15803d] text-[10px] font-bold uppercase tracking-wider">
                      <ShieldCheck size={10} /> Verified
                    </span>
                  </div>
                  <p className="text-xs font-mono font-semibold text-slate-600">
                    {account.maskedAccountNumber}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">{account.accountName}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={openModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer"
              >
                <Edit2 size={12} /> Edit Bank Account
              </button>
            </motion.div>
          ) : (
            // ─── No payout account state ───────────────────────────────────
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
                <Landmark size={22} className="text-slate-400" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">No payout account added</h4>
              <p className="text-xs text-slate-500 max-w-xs mb-5 leading-relaxed">
                Add a verified bank account to receive your earnings from successful sales on AgroLink.
              </p>
              <button
                type="button"
                onClick={openModal}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#15803d] hover:bg-[#166534] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Bank Account
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={!isBusy ? closeModal : undefined}
            />

            {/* Modal panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-xl relative z-10 border border-slate-200 overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <CreditCard size={15} className="text-[#15803d]" />
                  </div>
                  <h3 className="text-sm font-sans font-bold text-slate-900">
                    {account ? 'Edit Bank Account' : 'Add Bank Account'}
                  </h3>
                </div>
                {!isBusy && (
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="p-6 space-y-5">
                {/* ── Bank list error with Retry ─────────────────────────── */}
                {banksError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                      <span>{banksError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={loadBanks}
                      disabled={loadingBanks}
                      className="shrink-0 px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={loadingBanks ? 'animate-spin' : ''} />
                      Retry
                    </button>
                  </div>
                )}

                {/* ── Verification error ─────────────────────────────────── */}
                {verifyError && step === 'form' && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-600" />
                    <span>{verifyError}</span>
                  </div>
                )}

                {/* ── Save error ─────────────────────────────────────────── */}
                {saveError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-600" />
                    <span>{saveError}</span>
                  </div>
                )}

                {/* ── FORM FIELDS ────────────────────────────────────────── */}
                {(step === 'form' ||
                  step === 'verifying' ||
                  step === 'confirmed' ||
                  step === 'saving') && (
                  <div className="space-y-4">
                    {/* ── Searchable Bank Selector ──────────────────────── */}
                    <div className="relative" ref={dropdownRef}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Nigerian Bank
                      </label>

                      {/* Dropdown trigger button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!isBusy && !loadingBanks) {
                            setIsDropdownOpen((prev) => !prev);
                          }
                        }}
                        disabled={isBusy || loadingBanks}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-left flex items-center justify-between focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <span className={form.bankName ? 'text-slate-900' : 'text-slate-400'}>
                          {loadingBanks
                            ? 'Loading Nigerian banks...'
                            : form.bankName || 'Select a Nigerian bank ▾'}
                        </span>
                        {loadingBanks ? (
                          <Loader2 size={14} className="animate-spin text-[#15803d]" />
                        ) : (
                          <ChevronDown
                            size={14}
                            className={`text-slate-400 transition-transform duration-200 ${
                              isDropdownOpen ? 'rotate-180 text-slate-600' : ''
                            }`}
                          />
                        )}
                      </button>

                      {/* Dropdown popover menu */}
                      <AnimatePresence>
                        {isDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                          >
                            {/* Search input header */}
                            <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                              <Search size={14} className="text-slate-400 shrink-0 ml-1.5" />
                              <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search bank name..."
                                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none py-1"
                              />
                              {searchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setSearchQuery('')}
                                  className="text-slate-400 hover:text-slate-600 p-1"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>

                            {/* Bank items list */}
                            <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                              {loadingBanks ? (
                                <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                                  <Loader2 size={14} className="animate-spin text-[#15803d]" />
                                  <span>Loading Nigerian banks...</span>
                                </div>
                              ) : filteredBanks.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400">
                                  {banks.length === 0
                                    ? 'No banks available. Click Retry above.'
                                    : `No banks found matching "${searchQuery}"`}
                                </div>
                              ) : (
                                filteredBanks.map((b) => {
                                  const isSelected = form.bankCode === b.code;
                                  return (
                                    <button
                                      key={b.code}
                                      type="button"
                                      onClick={() => handleSelectBank(b)}
                                      className={`w-full px-3.5 py-2.5 text-xs text-left flex items-center justify-between transition-colors cursor-pointer ${
                                        isSelected
                                          ? 'bg-emerald-50 text-[#15803d] font-bold'
                                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                                      }`}
                                    >
                                      <span>{b.name}</span>
                                      {isSelected && (
                                        <Check size={14} className="text-[#15803d] shrink-0" />
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* ── 10-digit Account Number ────────────────────────── */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Account Number
                        </label>
                        <span
                          className={`text-[10px] font-mono ${
                            form.accountNumber.length === 10
                              ? 'text-[#15803d] font-bold'
                              : 'text-slate-400'
                          }`}
                        >
                          {form.accountNumber.length}/10 digits
                        </span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={10}
                        value={form.accountNumber}
                        onChange={handleAccountNumberChange}
                        disabled={isBusy}
                        placeholder="Enter 10-digit account number"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] font-mono tracking-widest disabled:opacity-60 transition-colors"
                      />
                    </div>

                    {/* ── Verified Account Name Display ─────────────────── */}
                    <AnimatePresence>
                      {step === 'confirmed' && verifiedName && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2"
                        >
                          <div className="flex items-center gap-2 text-[#15803d]">
                            <CheckCircle2 size={16} className="shrink-0" />
                            <span className="text-xs font-bold">Bank account verified</span>
                          </div>
                          <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 pt-1 text-xs">
                            <span className="text-slate-500 font-medium">Bank</span>
                            <span className="col-span-2 font-semibold text-slate-800">
                              {form.bankName}
                            </span>

                            <span className="text-slate-500 font-medium">Account</span>
                            <span className="col-span-2 font-mono font-semibold text-slate-800">
                              {verifiedMasked}
                            </span>

                            <span className="text-slate-500 font-medium">Account Name</span>
                            <span className="col-span-2 font-bold text-slate-900">
                              {verifiedName}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 pt-1 leading-normal">
                            Please confirm that the account name above matches your legal bank name before saving.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* ── Verifying loading indicator ───────────────────── */}
                    {step === 'verifying' && (
                      <div className="flex items-center gap-2.5 text-xs text-slate-600 py-1 px-1">
                        <Loader2 size={15} className="animate-spin text-[#15803d] shrink-0" />
                        <span className="font-medium">
                          Verifying account details with Paystack...
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Action buttons ──────────────────────────────────── */}
                <div className="flex gap-2.5 pt-1">
                  {/* Cancel button */}
                  {!isBusy && (
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}

                  {/* Verify Account — visible in 'form' step */}
                  {step === 'form' && (
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={
                        !form.bankCode || form.accountNumber.length !== 10 || loadingBanks
                      }
                      className="flex-1 py-2.5 bg-[#15803d] hover:bg-[#166534] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Verify Account
                    </button>
                  )}

                  {/* Verifying spinner button */}
                  {step === 'verifying' && (
                    <button
                      type="button"
                      disabled
                      className="flex-1 py-2.5 bg-[#15803d]/70 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Loader2 size={13} className="animate-spin" />
                      Verifying...
                    </button>
                  )}

                  {/* Confirm & Save — visible once verified */}
                  {step === 'confirmed' && (
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex-1 py-2.5 bg-[#15803d] hover:bg-[#166534] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Confirm &amp; Save
                    </button>
                  )}

                  {/* Saving spinner button */}
                  {step === 'saving' && (
                    <button
                      type="button"
                      disabled
                      className="flex-1 py-2.5 bg-[#15803d]/70 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Loader2 size={13} className="animate-spin" />
                      Saving...
                    </button>
                  )}
                </div>

                {/* Security footer notice */}
                <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                  Bank verification is performed securely via Paystack. AgroLink never stores your
                  full account number or Paystack credentials.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

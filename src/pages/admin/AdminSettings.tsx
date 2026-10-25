import React, { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, Percent, CheckCircle2 } from 'lucide-react';

export const AdminSettings = () => {
  const [commission, setCommission] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const settingsStr = localStorage.getItem('agrilink_settings');
    if (settingsStr) {
      const settings = JSON.parse(settingsStr);
      if (settings.commissionRate) {
        setCommission(settings.commissionRate);
      }
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');

    await new Promise(resolve => setTimeout(resolve, 600));

    const settings = { commissionRate: commission };
    localStorage.setItem('agrilink_settings', JSON.stringify(settings));
    
    const logs = JSON.parse(localStorage.getItem('agrilink_audit_logs') || '[]');
    logs.push({
      id: Date.now().toString(),
      adminId: 'admin_1',
      action: `Updated platform commission to ${commission}%`,
      entityType: 'Settings',
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('agrilink_audit_logs', JSON.stringify(logs));

    setIsSaving(false);
    setSaveMessage('Settings updated successfully.');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-body text-slate-900">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 font-sans tracking-tight">Platform Configuration</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">Manage global operational parameters, fee structures, and audit logs.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3.5 bg-slate-50/50">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0057b8]">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-950 font-sans">Revenue & Fee Model</h3>
            <p className="text-xs text-slate-500">Configure marketplace facilitation and commission rates.</p>
          </div>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Marketplace Commission Rate (%)
            </label>
            <div className="relative max-w-xs">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                required
                value={commission}
                onChange={(e) => setCommission(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0057b8]/20 focus:border-[#0057b8]"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Standard percentage applied on gross transaction value for completed orders.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#0057b8] hover:bg-[#003e8a] text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Save size={14} />
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
            {saveMessage && (
              <span className="text-xs font-medium text-[#15803d] flex items-center gap-1">
                <CheckCircle2 size={14} /> {saveMessage}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

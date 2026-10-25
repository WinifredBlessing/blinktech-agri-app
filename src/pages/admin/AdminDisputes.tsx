import React, { useState, useEffect } from 'react';
import { Dispute } from '../../types';
import { Search, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';

export const AdminDisputes = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let allDisputes: Dispute[] = JSON.parse(localStorage.getItem('agrilink_disputes') || '[]');
    // Seed some demo disputes if none exist for UI showcasing
    if (allDisputes.length === 0) {
      allDisputes = [
        {
          id: 'disp_1',
          orderId: 'ord_1024',
          buyerId: 'buy_1',
          farmerId: 'farm_1',
          issue: 'Payment made but produce was not delivered within the agreed timeframe.',
          status: 'Open',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('agrilink_disputes', JSON.stringify(allDisputes));
    }
    setDisputes(allDisputes);
  }, []);

  const handleResolve = (id: string, status: 'Resolved' | 'Rejected') => {
    if (window.confirm(`Are you sure you want to mark this dispute as ${status}?`)) {
      const updated = disputes.map(d => d.id === id ? { ...d, status } : d);
      setDisputes(updated);
      localStorage.setItem('agrilink_disputes', JSON.stringify(updated));
      
      const logs = JSON.parse(localStorage.getItem('agrilink_audit_logs') || '[]');
      logs.push({
        id: Date.now().toString(),
        adminId: 'admin_1',
        action: `Marked dispute ${id} as ${status}`,
        entityType: 'Dispute',
        entityId: id,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('agrilink_audit_logs', JSON.stringify(logs));
    }
  };

  const filteredDisputes = disputes.filter(d => 
    d.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.orderId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">Dispute Resolution</h1>
          <p className="text-sm text-slate-500 mt-1">Review and resolve reported issues between buyers and farmers.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center bg-slate-50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Dispute ID or Order ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Dispute ID</th>
                <th className="px-6 py-4 font-medium">Order ID</th>
                <th className="px-6 py-4 font-medium w-1/3">Issue Description</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDisputes.length > 0 ? (
                filteredDisputes.map((dispute) => (
                  <tr key={dispute.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-slate-900 font-medium">#{dispute.id.slice(0, 8)}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{new Date(dispute.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-slate-900">#{dispute.orderId.slice(0, 8)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-900 truncate max-w-sm" title={dispute.issue}>{dispute.issue}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        dispute.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' :
                        dispute.status === 'Rejected' ? 'bg-slate-100 text-slate-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {dispute.status === 'Open' && <AlertTriangle className="w-3.5 h-3.5" />}
                        {dispute.status === 'Resolved' && <CheckCircle className="w-3.5 h-3.5" />}
                        {dispute.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {dispute.status === 'Open' ? (
                        <div className="flex items-center justify-end gap-3">
                          <button 
                            onClick={() => handleResolve(dispute.id, 'Resolved')}
                            className="text-emerald-600 hover:text-emerald-700 font-medium text-xs transition-colors">
                            Resolve
                          </button>
                          <button 
                            onClick={() => handleResolve(dispute.id, 'Rejected')}
                            className="text-slate-500 hover:text-slate-700 font-medium text-xs transition-colors">
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button className="inline-flex items-center text-brand-600 hover:text-brand-700 font-medium text-sm transition-colors">
                          View <ChevronRight className="w-4 h-4 ml-1" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No disputes found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

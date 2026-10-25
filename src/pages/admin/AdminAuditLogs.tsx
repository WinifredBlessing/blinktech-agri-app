import React, { useState, useEffect } from 'react';
import { Shield, Search, Clock } from 'lucide-react';

export const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const auditLogs = JSON.parse(localStorage.getItem('agrilink_audit_logs') || '[]');
    // Sort by newest first
    auditLogs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setLogs(auditLogs);
  }, []);

  const filteredLogs = logs.filter(l => 
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.entityType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">Track all sensitive administrator actions.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 relative">
           <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search logs by action or entity..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-1">
                  <Shield className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{log.action}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                    <span className="inline-flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    <span>Admin: <span className="font-medium text-slate-700">{log.adminId}</span></span>
                    <span>Entity: <span className="font-medium text-slate-700">{log.entityType}</span></span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">
              No audit logs recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

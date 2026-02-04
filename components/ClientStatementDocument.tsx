import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Client, Player, TrainingSession, Payment } from '@/lib/playbook';

interface ClientStatementDocumentProps {
  client: Client;
  players: Player[];
  sessions: TrainingSession[];
  onClose?: () => void;
}

export function ClientStatementDocument({ client, players, sessions, onClose }: ClientStatementDocumentProps) {
  const clientKids = useMemo(() => players.filter(p => p.clientId === client.id), [players, client.id]);

  const statementData = useMemo(() => {
    // 1. Identify all players for this client
    const playerIds = new Set(clientKids.map(p => p.id));
    
    // 2. Find all sessions attended by these players
    const clientSessions = sessions.filter(s => 
      s.participantIds.some(pid => playerIds.has(pid))
    );

    // 3. Create Transaction Items
    const transactions: { date: string; desc: string; debit: number; credit: number; timestamp: number; type: 'fee' | 'payment' }[] = [];

    // Add Payments
    if (client.payments) {
      client.payments.forEach(p => {
        transactions.push({
          date: p.date,
          desc: `Payment Received - ${p.reference || 'Thank you'}`,
          debit: 0,
          credit: p.amount,
          timestamp: new Date(p.date).getTime(),
          type: 'payment'
        });
      });
    }

    // Add Session Fees
    clientSessions.forEach(s => {
      // For each player of this client in this session
      const involvedPlayers = s.participantIds.filter(pid => playerIds.has(pid));
      involvedPlayers.forEach(pid => {
        const p = players.find(x => x.id === pid);
        
        // Calculate other participants
        const others = s.participantIds
           .filter(id => id !== pid)
           .map(id => players.find(x => x.id === id)?.name)
           .filter(Boolean);

        let typeDisplay = s.type;
                 if (s.type === 'Semi') typeDisplay = 'Semi';        if (s.type === 'Group') typeDisplay = 'Group'; 
        if (s.type === 'Private') typeDisplay = 'Private'; 

        // Correct suffix logic
        const typeLabel = typeDisplay.includes('Session') ? typeDisplay : `${typeDisplay} Session`;

        const timeRange = `${s.startTime} - ${s.endTime}`;
        const withOthers = others.length > 0 ? ` (with ${others.join(', ')})` : '';
        
        transactions.push({
          date: s.date,
          desc: `${typeLabel} (${timeRange}) - ${p?.name || 'Player'}${withOthers}`,
          debit: s.price || 0, 
          credit: 0,
          timestamp: new Date(`${s.date}T${s.startTime}`).getTime(),
          type: 'fee'
        });
      });
    });

    // 4. Sort Chronologically
    transactions.sort((a, b) => a.timestamp - b.timestamp);

    // 5. Calculate Running Balance
    let balance = 0;
    const rows = transactions.map(t => {
      balance += (t.debit - t.credit);
      return { ...t, balance };
    });

    return { rows, finalBalance: balance };
  }, [client, players, sessions]);

  return (
    <div className="fixed inset-0 z-[100] bg-white text-black overflow-y-auto print:overflow-visible flex flex-col items-center p-8 print:p-0">
      {/* Print Controls (Hidden in Print) */}
      <div className="w-[210mm] mb-4 flex justify-between items-center no-print">
        <button 
           onClick={onClose}
           className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-bold text-gray-800"
        >
           &larr; Back
        </button>
        <div className="flex gap-2">
           <button 
              onClick={() => window.print()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-bold text-white shadow-lg"
           >
              Print Statement
           </button>
        </div>
      </div>

      {/* A4 Sheet */}
      <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none p-[10mm] relative flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
           <div className="flex items-center gap-4">
              {/* Logo Placeholder */}
              <div className="w-16 h-16 bg-black text-white flex items-center justify-center font-black text-2xl rounded-full">
                 TL
              </div>
              <div>
                 <h1 className="text-3xl font-black uppercase tracking-tighter">VON GERICKE ACADEMY</h1>
                 <p className="text-xs font-bold uppercase tracking-widest text-gray-500">High Performance Coaching</p>
              </div>
           </div>
           <div className="text-right text-xs leading-relaxed">
              <p className="font-bold">Date: {new Date().toLocaleDateString()}</p>
              <p>Pretoria, South Africa</p>
              <p>admin@tennislab.co.za</p>
           </div>
        </div>

        {/* Banking Details (Moved Top) */}
        <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center print:bg-transparent print:border-gray-300">
           <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Banking Details</h3>
              <p className="font-bold text-sm">EBENHAESER VON GERICKE</p>
              <p className="text-xs">FNB Savings Account: 62878455643</p>
              <p className="text-xs">Branch: 250655</p>
           </div>
           <div className="text-right">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Reference</h3>
              <p className="font-bold text-sm bg-black text-white px-2 py-1 rounded inline-block print:text-black print:border print:border-black print:bg-transparent">
                 {clientKids.length > 0 ? clientKids[0].name.split(' ')[0] : client.name} - {new Date().toLocaleString('default', { month: 'short' })}
              </p>
           </div>
        </div>

        {/* Bill To */}
        <div className="mb-8">
           <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Statement For</h3>
           <div className="text-2xl font-bold">{client.name}</div>
           <div className="text-sm text-gray-600">{client.email}</div>
           <div className="text-sm text-gray-600">{client.phone}</div>
        </div>

        {/* Statement Table */}
        <table className="w-full text-sm mb-8">
           <thead>
              <tr className="border-b-2 border-black">
                 <th className="py-2 text-left w-24 font-bold uppercase text-xs tracking-wider">Date</th>
                 <th className="py-2 text-left font-bold uppercase text-xs tracking-wider">Description</th>
                 <th className="py-2 text-right w-24 font-bold uppercase text-xs tracking-wider">Fee</th>
                 <th className="py-2 text-right w-24 font-bold uppercase text-xs tracking-wider">Paid</th>
                 <th className="py-2 text-right w-28 font-bold uppercase text-xs tracking-wider">Balance</th>
              </tr>
           </thead>
           <tbody>
              {statementData.rows.map((row, i) => (
                 <tr key={i} className={cn("border-b border-gray-100", row.type === 'payment' && "bg-green-50/50 print:bg-transparent")}>
                    <td className="py-3 text-gray-600 font-mono text-xs">{row.date}</td>
                    <td className="py-3">
                       <span className={cn("font-medium", row.type === 'payment' ? "text-green-700 font-bold" : "text-gray-900")}>
                          {row.desc}
                       </span>
                    </td>
                    <td className="py-3 text-right text-gray-600">{row.debit > 0 ? `R ${row.debit.toFixed(2)}` : '-'}</td>
                    <td className="py-3 text-right text-green-600 font-bold">{row.credit > 0 ? `R ${row.credit.toFixed(2)}` : '-'}</td>
                    <td className="py-3 text-right font-mono font-bold">R {row.balance.toFixed(2)}</td>
                 </tr>
              ))}
              {statementData.rows.length === 0 && (
                 <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 italic border-b border-gray-100">
                       No transactions found for this account.
                    </td>
                 </tr>
              )}
           </tbody>
           <tfoot>
              <tr>
                 <td colSpan={3} className="pt-6"></td>
                 <td className="pt-6 text-right font-bold text-gray-500 uppercase text-xs tracking-widest">Total Due</td>
                 <td className="pt-6 text-right font-black text-2xl border-b-4 border-black pb-1">
                    R {statementData.finalBalance.toFixed(2)}
                 </td>
              </tr>
           </tfoot>
        </table>

        {/* Footer */}
        <div className="mt-auto pt-8 border-t border-gray-200 text-xs text-gray-400 text-center uppercase tracking-widest font-bold">
           Thank you for your continued support.
        </div>

      </div>
    </div>
  );
}

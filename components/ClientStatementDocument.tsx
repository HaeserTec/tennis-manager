import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Client, Player, TrainingSession, Payment, DayEvent } from '@/lib/playbook';
import { getSessionBillingForClient } from '@/lib/billing';

interface ClientStatementDocumentProps {
  client: Client;
  players: Player[];
  sessions: TrainingSession[];
  dayEvents?: DayEvent[];
  onClose?: () => void;
}

export function ClientStatementDocument({ client, players, sessions, dayEvents = [], onClose }: ClientStatementDocumentProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const clientKids = useMemo(() => players.filter(p => p.clientId === client.id), [players, client.id]);

  const statementData = useMemo(() => {
    // 1. Identify all players for this client
    const playerIds = new Set(clientKids.map(p => p.id));
    
    // 2. Find all sessions attended by these players
    const clientSessions = sessions.filter(s => 
      s.participantIds.some(pid => playerIds.has(pid))
    );

    // 3. Create ALL Transaction Items first
    const allTransactions: { date: string; desc: string; debit: number; credit: number; timestamp: number; type: 'fee' | 'payment' | 'balance' | 'credit' }[] = [];

    // Add Payments
    if (client.payments) {
      client.payments.forEach(p => {
        allTransactions.push({
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
      const billing = getSessionBillingForClient(s, playerIds, dayEvents);
      if (billing.status === 'rain') return;

      // For each player of this client in this session (description detail)
      const involvedPlayers = s.participantIds.filter(pid => playerIds.has(pid));
      involvedPlayers.forEach(pid => {
        const p = players.find(x => x.id === pid);
        
        // Calculate other participants
        const others = s.participantIds
           .filter(id => id !== pid)
           .map(id => players.find(x => x.id === id)?.name)
           .filter(Boolean);

        let typeDisplay = s.type;
        if (s.type === 'Semi') typeDisplay = 'Semi';
        if (s.type === 'Group') typeDisplay = 'Group'; 
        if (s.type === 'Private') typeDisplay = 'Private'; 

        // Correct suffix logic
        const typeLabel = typeDisplay.includes('Session') ? typeDisplay : `${typeDisplay} Session`;

        const timeRange = `${s.startTime} - ${s.endTime}`;
        const withOthers = others.length > 0 ? ` (with ${others.join(', ')})` : '';
        
        if (billing.status === 'cancelled') {
          allTransactions.push({
            date: s.date,
            desc: `Credit - Coach Cancelled (${timeRange}) - ${p?.name || 'Player'}${withOthers}`,
            debit: 0,
            credit: s.price || 0,
            timestamp: new Date(`${s.date}T${s.startTime}`).getTime(),
            type: 'credit'
          });
        } else {
          allTransactions.push({
            date: s.date,
            desc: `${typeLabel} (${timeRange}) - ${p?.name || 'Player'}${withOthers}`,
            debit: s.price || 0, 
            credit: 0,
            timestamp: new Date(`${s.date}T${s.startTime}`).getTime(),
            type: 'fee'
          });
        }
      });
    });

    // 4. Sort Chronologically
    allTransactions.sort((a, b) => a.timestamp - b.timestamp);

    // 5. Filter by Selected Month & Calculate Opening Balance
    // selectedMonth is "YYYY-MM"
    // We treat dates as string comparisons for simplicity and timezone safety "YYYY-MM-DD"
    const startPrefix = selectedMonth;
    
    let openingBalance = 0;
    const currentRows: typeof allTransactions = [];

    allTransactions.forEach(t => {
       // Check if transaction is BEFORE selected month
       // String comparison: "2023-01-15" < "2023-02" is true
       if (t.date < startPrefix + "-01") {
          openingBalance += (t.debit - t.credit);
       } 
       // Check if transaction is IN selected month
       else if (t.date.startsWith(startPrefix)) {
          currentRows.push(t);
       }
       // Future transactions are ignored for the statement of this month
    });

    // 6. Build Final Rows
    let runningBalance = openingBalance;
    const finalRows: typeof allTransactions = [];

    // Always add B/F row
    finalRows.push({
       date: `${selectedMonth}-01`,
       desc: "Balance Brought Forward",
       debit: 0,
       credit: 0,
       timestamp: 0, // Irrelevant
       balance: openingBalance,
       type: 'balance'
    } as any);

    const rows = currentRows.map(t => {
      runningBalance += (t.debit - t.credit);
      return { ...t, balance: runningBalance };
    });

    return { rows: [...finalRows, ...rows], finalBalance: runningBalance };
  }, [client, players, sessions, selectedMonth]);

  return (
    <div className="fixed inset-0 z-[100] bg-white text-black overflow-y-auto print:overflow-visible flex flex-col items-center p-8 print:p-0">
      {/* Print Controls (Hidden in Print) */}
      <div className="w-[210mm] mb-4 flex justify-between items-center no-print">
        <div className="flex gap-4 items-center">
           <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-bold text-gray-800"
           >
              &larr; Back
           </button>
           
           <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg border border-gray-300">
              <span className="text-xs font-bold text-gray-500 pl-2 uppercase tracking-wider">Statement Month:</span>
              <input 
                 type="month" 
                 value={selectedMonth} 
                 onChange={(e) => setSelectedMonth(e.target.value)}
                 className="bg-white border border-gray-300 rounded px-2 py-1 text-sm font-bold"
              />
           </div>
        </div>

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
      <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none p-[15mm] print:p-[10mm] relative flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
           <div className="flex items-center gap-3">
              {/* Logo Placeholder */}
              <div className="w-12 h-12 bg-black text-white flex items-center justify-center font-black text-xl rounded-full">
                 TL
              </div>
              <div>
                 <h1 className="text-2xl font-black uppercase tracking-tighter">VON GERICKE ACADEMY</h1>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">High Performance Coaching</p>
              </div>
           </div>
           <div className="text-right text-[10px] leading-relaxed">
              <p className="font-bold">Date: {new Date().toLocaleDateString()}</p>
              <p>Pretoria, South Africa</p>
              <p>admin@tennislab.co.za</p>
           </div>
        </div>

        {/* Banking Details (Compact) */}
        <div className="mb-6 p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center print:bg-transparent print:border-gray-300">
           <div>
              <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Banking Details</h3>
              <p className="font-bold text-xs">EBENHAESER VON GERICKE</p>
              <div className="flex gap-3 text-[10px] text-gray-700">
                 <p>FNB Savings: <span className="font-mono">62878455643</span></p>
                 <p>Branch: <span className="font-mono">250655</span></p>
              </div>
           </div>
           <div className="text-right">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Reference</h3>
              <p className="font-bold text-xs bg-black text-white px-2 py-0.5 rounded inline-block print:text-black print:border print:border-black print:bg-transparent">
                 {clientKids.length > 0 ? clientKids[0].name.split(' ')[0] : client.name} - {new Date(selectedMonth).toLocaleString('default', { month: 'short', year: '2-digit' })}
              </p>
           </div>
        </div>

        {/* Bill To */}
        <div className="mb-6">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Statement For</h3>
           <div className="text-xl font-bold">{client.name}</div>
           <div className="flex gap-4 text-xs text-gray-600">
              <p>{client.email}</p>
              <p>{client.phone}</p>
           </div>
        </div>

        {/* Statement Table */}
        <table className="w-full text-xs mb-6">
           <thead>
              <tr className="border-b-2 border-black">
                 <th className="py-1.5 text-left w-20 font-bold uppercase text-[10px] tracking-wider">Date</th>
                 <th className="py-1.5 text-left font-bold uppercase text-[10px] tracking-wider">Description</th>
                 <th className="py-1.5 text-right w-20 font-bold uppercase text-[10px] tracking-wider">Fee</th>
                 <th className="py-1.5 text-right w-20 font-bold uppercase text-[10px] tracking-wider">Credit</th>
                 <th className="py-1.5 text-right w-24 font-bold uppercase text-[10px] tracking-wider">Balance</th>
              </tr>
           </thead>
           <tbody className="text-[11px]">
              {statementData.rows.map((row, i) => (
                 <tr key={i} className={cn("border-b border-gray-100", row.type === 'payment' && "bg-green-50/50 print:bg-transparent", row.type === 'credit' && "bg-blue-50/50 print:bg-transparent", row.type === 'balance' && "bg-gray-50 font-bold print:bg-transparent")}>
                    <td className="py-1.5 text-gray-600 font-mono">{row.date}</td>
                    <td className="py-1.5">
                       <span className={cn("font-medium", row.type === 'payment' ? "text-green-700 font-bold" : row.type === 'credit' ? "text-blue-700 font-bold" : "text-gray-900")}>
                          {row.desc}
                       </span>
                    </td>
                    <td className="py-1.5 text-right text-gray-600">
                        {row.type !== 'balance' && row.debit > 0 ? `R ${row.debit.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-1.5 text-right text-green-600 font-bold">
                        {row.type !== 'balance' && row.credit > 0 ? `R ${row.credit.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-1.5 text-right font-mono font-bold">R {row.balance.toFixed(2)}</td>
                 </tr>
              ))}
              {statementData.rows.length === 1 && (
                 <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 italic border-b border-gray-100">
                       No transactions found for {selectedMonth}.
                    </td>
                 </tr>
              )}
           </tbody>
           <tfoot>
              <tr>
                 <td colSpan={3} className="pt-4"></td>
                 <td className="pt-4 text-right font-bold text-gray-500 uppercase text-[10px] tracking-widest">Total Due</td>
                 <td className="pt-4 text-right font-black text-xl border-b-4 border-black pb-1">
                    R {statementData.finalBalance.toFixed(2)}
                 </td>
              </tr>
           </tfoot>
        </table>

        {/* Footer */}
        <div className="mt-auto pt-6 border-t border-gray-200 text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">
           Thank you for your continued support.
        </div>

      </div>
    </div>
  );
}

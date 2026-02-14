import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn, parseISODateLocal, toLocalISODate } from '@/lib/utils';
import type { Client, Player, TrainingSession, Payment, DayEvent } from '@/lib/playbook';
import { getSessionBillingForClient } from '@/lib/billing';

interface ClientStatementDocumentProps {
  client: Client;
  players: Player[];
  sessions: TrainingSession[];
  dayEvents?: DayEvent[];
  onClose?: () => void;
  autoPrint?: boolean;
}

interface StatementTransaction {
  date: string;
  desc: string;
  debit: number;
  credit: number;
  timestamp: number;
  type: 'fee' | 'payment' | 'credit';
  childId: string;
  proofUrl?: string;
}

interface StatementSection {
  childId: string;
  childName: string;
  openingBalance: number;
  rows: StatementTransaction[];
  subtotal: number;
}

function getFamilyName(displayName: string): string {
  const clean = displayName.trim();
  if (!clean) return 'Family';
  const parts = clean.split(/\s+/);
  return parts[parts.length - 1];
}

function getFirstName(displayName: string): string {
  const clean = displayName.trim();
  if (!clean) return 'Player';
  return clean.split(/\s+/)[0];
}

export function ClientStatementDocument({ client, players, sessions, dayEvents = [], onClose, autoPrint = false }: ClientStatementDocumentProps) {
  const [selectedMonth, setSelectedMonth] = useState(toLocalISODate(new Date()).slice(0, 7));
  const [selectedChildId, setSelectedChildId] = useState<string>('all');
  const hasAutoPrintedRef = useRef(false);
  
  const clientKids = useMemo(() => players.filter(p => p.clientId === client.id), [players, client.id]);
  const clientKidMap = useMemo(() => new Map(clientKids.map((k) => [k.id, k.name])), [clientKids]);
  const familyName = useMemo(() => getFamilyName(client.name), [client.name]);
  const sortedKids = useMemo(() => {
    return [...clientKids].sort((a, b) => {
      if (a.dob && b.dob) return a.dob.localeCompare(b.dob);
      if (a.dob) return -1;
      if (b.dob) return 1;
      if (typeof a.age === 'number' && typeof b.age === 'number') return b.age - a.age;
      return a.name.localeCompare(b.name);
    });
  }, [clientKids]);
  const selectedChildName = selectedChildId === 'all'
    ? `${familyName} Family`
    : (clientKidMap.get(selectedChildId) || 'Player');

  const statementData = useMemo(() => {
    const scopedKids = selectedChildId === 'all'
      ? sortedKids
      : sortedKids.filter((p) => p.id === selectedChildId);
    const scopedIds = new Set(scopedKids.map((k) => k.id));
    const clientAllPlayerIds = new Set(clientKids.map((k) => k.id));

    const allTransactions: StatementTransaction[] = [];

    const unassignedPayments: Array<{ payment: Payment; proofUrl?: string }> = [];
    (client.payments || []).forEach((payment) => {
      const paymentPlayerId = (payment as any).playerId as string | undefined;
      if (paymentPlayerId && scopedIds.has(paymentPlayerId)) {
        allTransactions.push({
          childId: paymentPlayerId,
          date: payment.date,
          desc: `Payment Received - ${payment.reference || 'Thank you'}`,
          debit: 0,
          credit: payment.amount,
          timestamp: parseISODateLocal(payment.date).getTime(),
          type: 'payment',
          proofUrl: (payment as any).proofUrl
        });
        return;
      }
      if (!paymentPlayerId && selectedChildId === 'all') {
        unassignedPayments.push({ payment, proofUrl: (payment as any).proofUrl });
      }
      if (!paymentPlayerId && selectedChildId !== 'all' && scopedKids[0]) {
        allTransactions.push({
          childId: scopedKids[0].id,
          date: payment.date,
          desc: `Payment Received - ${payment.reference || 'Thank you'}`,
          debit: 0,
          credit: payment.amount,
          timestamp: parseISODateLocal(payment.date).getTime(),
          type: 'payment',
          proofUrl: (payment as any).proofUrl
        });
      }
    });

    if (selectedChildId === 'all' && unassignedPayments.length > 0 && scopedKids.length > 0) {
      unassignedPayments.forEach(({ payment, proofUrl }) => {
        const split = payment.amount / scopedKids.length;
        let remaining = payment.amount;
        scopedKids.forEach((kid, idx) => {
          const portion = idx === scopedKids.length - 1 ? remaining : Number(split.toFixed(2));
          remaining = Number((remaining - portion).toFixed(2));
          allTransactions.push({
            childId: kid.id,
            date: payment.date,
            desc: `Payment Received - ${payment.reference || 'Thank you'}`,
            debit: 0,
            credit: portion,
            timestamp: parseISODateLocal(payment.date).getTime(),
            type: 'payment',
            proofUrl
          });
        });
      });
    }

    const clientSessions = sessions.filter((session) =>
      session.participantIds.some((pid) => clientAllPlayerIds.has(pid))
    );

    clientSessions.forEach((session) => {
      const billableParticipants = session.participantIds.filter((pid) => scopedIds.has(pid));
      if (billableParticipants.length === 0) return;

      const billing = getSessionBillingForClient(session, new Set(billableParticipants), dayEvents);
      if (billing.status === 'rain') return;

      billableParticipants.forEach((pid) => {
        const otherNames = session.participantIds
          .filter((id) => id !== pid)
          .map((id) => {
            const fullName = players.find((x) => x.id === id)?.name;
            return fullName ? getFirstName(fullName) : undefined;
          })
          .filter(Boolean);
        const timeRange = `${session.startTime} - ${session.endTime}`;
        const withOthers = otherNames.length > 0 ? ` (with ${otherNames.join(', ')})` : '';
        const typeLabel = session.type.includes('Session') ? session.type : `${session.type} Session`;

        if (billing.status === 'cancelled') {
          allTransactions.push({
            childId: pid,
            date: session.date,
            desc: `Credit - Coach Cancelled (${timeRange})${withOthers}`,
            debit: 0,
            credit: session.price || 0,
            timestamp: new Date(`${session.date}T${session.startTime}`).getTime(),
            type: 'credit'
          });
        } else {
          allTransactions.push({
            childId: pid,
            date: session.date,
            desc: `${typeLabel} (${timeRange})${withOthers}`,
            debit: session.price || 0,
            credit: 0,
            timestamp: new Date(`${session.date}T${session.startTime}`).getTime(),
            type: 'fee'
          });
        }
      });
    });

    const monthStart = `${selectedMonth}-01`;
    const sections: StatementSection[] = scopedKids.map((kid) => {
      const rowsForKid = allTransactions
        .filter((row) => row.childId === kid.id)
        .sort((a, b) => a.timestamp - b.timestamp);

      const openingBalance = rowsForKid
        .filter((row) => row.date < monthStart)
        .reduce((sum, row) => sum + row.debit - row.credit, 0);

      const inMonthRows = rowsForKid.filter((row) => row.date.startsWith(selectedMonth));
      const monthDelta = inMonthRows.reduce((sum, row) => sum + row.debit - row.credit, 0);

      return {
        childId: kid.id,
        childName: getFirstName(kid.name),
        openingBalance,
        rows: inMonthRows,
        subtotal: openingBalance + monthDelta
      };
    });

    const visibleSections = sections.filter((section) => section.rows.length > 0 || section.openingBalance !== 0);
    const finalBalance = visibleSections.reduce((sum, section) => sum + section.subtotal, 0);
    return { sections: visibleSections, finalBalance };
  }, [client.payments, clientKids, dayEvents, players, selectedChildId, selectedMonth, sessions, sortedKids]);

  useEffect(() => {
    if (!autoPrint) {
      hasAutoPrintedRef.current = false;
      return;
    }
    if (hasAutoPrintedRef.current) return;
    hasAutoPrintedRef.current = true;
    const timer = window.setTimeout(() => window.print(), 220);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

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
           <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg border border-gray-300">
              <span className="text-xs font-bold text-gray-500 pl-2 uppercase tracking-wider">Account:</span>
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="bg-white border border-gray-300 rounded px-2 py-1 text-sm font-bold"
              >
                <option value="all">{familyName} Family</option>
                {sortedKids.map((kid) => <option key={kid.id} value={kid.id}>{kid.name}</option>)}
              </select>
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
                 {selectedChildName} - {new Date(`${selectedMonth}-01T12:00:00`).toLocaleString('default', { month: 'short', year: '2-digit' })}
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
              <p><span className="font-bold">Players:</span> {sortedKids.map(k => getFirstName(k.name)).join(', ') || 'None'}</p>
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
              {statementData.sections.map((section) => {
                let runningBalance = section.openingBalance;
                return (
                  <React.Fragment key={section.childId}>
                    <tr className="bg-gray-100/80 print:bg-transparent border-y border-gray-300">
                      <td colSpan={5} className="py-1.5 px-1 font-black tracking-wide text-[11px] text-gray-900">
                        {section.childName}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100 bg-gray-50/70 print:bg-transparent font-bold">
                      <td className="py-1.5 text-gray-600 font-mono">{selectedMonth}-01</td>
                      <td className="py-1.5 text-gray-700">Balance Brought Forward</td>
                      <td className="py-1.5 text-right text-gray-600">-</td>
                      <td className="py-1.5 text-right text-green-600 font-bold">-</td>
                      <td className="py-1.5 text-right font-mono font-bold">R {runningBalance.toFixed(2)}</td>
                    </tr>
                    {section.rows.map((row, i) => {
                      runningBalance += row.debit - row.credit;
                      return (
                        <tr
                          key={`${section.childId}-${row.timestamp}-${i}`}
                          className={cn("border-b border-gray-100", row.type === 'payment' && "bg-green-50/50 print:bg-transparent", row.type === 'credit' && "bg-blue-50/50 print:bg-transparent")}
                        >
                          <td className="py-1.5 text-gray-600 font-mono">{row.date}</td>
                          <td className="py-1.5">
                            <span className={cn("font-medium", row.type === 'payment' ? "text-green-700 font-bold" : row.type === 'credit' ? "text-blue-700 font-bold" : "text-gray-900")}>
                              {row.desc}
                            </span>
                            {row.proofUrl && (
                              <a href={row.proofUrl} target="_blank" rel="noreferrer" className="ml-2 text-[10px] text-blue-700 underline">
                                View POP
                              </a>
                            )}
                          </td>
                          <td className="py-1.5 text-right text-gray-600">{row.debit > 0 ? `R ${row.debit.toFixed(2)}` : '-'}</td>
                          <td className="py-1.5 text-right text-green-600 font-bold">{row.credit > 0 ? `R ${row.credit.toFixed(2)}` : '-'}</td>
                          <td className="py-1.5 text-right font-mono font-bold">R {runningBalance.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-b-2 border-gray-300 bg-gray-50/70 print:bg-transparent">
                      <td colSpan={4} className="py-2 text-right font-bold uppercase tracking-wider text-[10px] text-gray-500">
                        {section.childName} Subtotal
                      </td>
                      <td className="py-2 text-right font-mono font-black">R {section.subtotal.toFixed(2)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {statementData.sections.length === 0 && (
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

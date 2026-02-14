import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, parseISODateLocal } from '@/lib/utils';
import type { Client, Player, TrainingSession, Payment, DayEvent } from '@/lib/playbook';
import { getSessionBillingForClient } from '@/lib/billing';

interface AccountsStatementProps {
  clients: Client[];
  players: Player[];
  sessions: TrainingSession[];
  dayEvents?: DayEvent[];
}

export function AccountsStatement({ clients, players, sessions, dayEvents = [] }: AccountsStatementProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  // Filter by Month
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const nextMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

  const reportData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filteredClients = clients.filter(c => c.name.toLowerCase().includes(q));

    const rows = filteredClients.map(client => {
       const clientPlayerIds = new Set(players.filter(p => p.clientId === client.id).map(p => p.id));
       
       // 1. Calculate Opening Balance (Prior to this month)
       let openingFees = 0;
       let openingCredits = 0;
       let openingPayments = 0;

       // Past Sessions
       sessions.forEach(s => {
          const sDate = parseISODateLocal(s.date);
          if (sDate < currentMonthStart && s.participantIds.some(pid => clientPlayerIds.has(pid))) {
             const billing = getSessionBillingForClient(s, clientPlayerIds, dayEvents);
             openingFees += billing.charge;
             openingCredits += billing.credit;
          }
       });

       // Past Payments
       (client.payments || []).forEach(p => {
          const pDate = parseISODateLocal(p.date);
          if (pDate < currentMonthStart) {
             openingPayments += p.amount;
          }
       });

       const openingBalance = openingFees - openingCredits - openingPayments;

       // 2. Sessions in this month
       const monthlySessions = sessions.filter(s => {
          const sDate = parseISODateLocal(s.date);
          return sDate >= currentMonthStart && sDate < nextMonthStart && s.participantIds.some(pid => clientPlayerIds.has(pid));
       });

       // Calculate Current Fees
       let fees = 0;
       let credits = 0;
       let sessionCount = 0;
       monthlySessions.forEach(s => {
          const billing = getSessionBillingForClient(s, clientPlayerIds, dayEvents);
          fees += billing.charge;
          credits += billing.credit;
          sessionCount += billing.involvedCount;
       });

       // 3. Payments in this month
       const monthlyPayments = (client.payments || []).filter(p => {
          const pDate = parseISODateLocal(p.date);
          return pDate >= currentMonthStart && pDate < nextMonthStart;
       });
       
       const payments = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);
       
       // 4. Final Balance
       const balance = openingBalance + fees - credits - payments;

       return {
          client,
          sessionCount,
          openingBalance,
          fees,
          credits,
          payments,
          balance
       };
    }).sort((a,b) => b.balance - a.balance);

    const totals = rows.reduce((acc, row) => ({
       openingBalance: acc.openingBalance + row.openingBalance,
       fees: acc.fees + row.fees,
       credits: acc.credits + row.credits,
       payments: acc.payments + row.payments,
       balance: acc.balance + row.balance,
       count: acc.count + row.sessionCount
    }), { openingBalance: 0, fees: 0, credits: 0, payments: 0, balance: 0, count: 0 });

    return { rows, totals };
  }, [clients, players, sessions, currentDate, searchQuery]);

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
       {/* Header */}
       <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
             <h2 className="text-2xl font-black uppercase tracking-tight">Financial Consolidation</h2>
             <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Monthly Overview</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center bg-card border border-border rounded-lg p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>
                   <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-4 font-bold text-sm min-w-[120px] text-center">
                   {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>
                   <ChevronRight className="w-4 h-4" />
                </Button>
             </div>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                   placeholder="Search client..." 
                   value={searchQuery} 
                   onChange={e => setSearchQuery(e.target.value)} 
                   className="pl-9 w-64 bg-card border-border" 
                />
             </div>
          </div>
       </div>

       {/* Table */}
       <div className="flex-1 overflow-auto p-6">
          <div className="border border-border rounded-xl overflow-hidden bg-card/30">
             <table className="w-full text-sm">
                <thead>
                   <tr className="bg-card/50 border-b border-border">
                      <th className="py-3 px-4 text-left font-black uppercase tracking-wider text-xs text-muted-foreground">Client</th>
                      <th className="py-3 px-4 text-right font-black uppercase tracking-wider text-xs text-muted-foreground">Brought Forward</th>
                      <th className="py-3 px-4 text-center font-black uppercase tracking-wider text-xs text-muted-foreground">Sessions</th>
                      <th className="py-3 px-4 text-right font-black uppercase tracking-wider text-xs text-muted-foreground">Expected (Fees)</th>
                      <th className="py-3 px-4 text-right font-black uppercase tracking-wider text-xs text-muted-foreground">Credits</th>
                      <th className="py-3 px-4 text-right font-black uppercase tracking-wider text-xs text-muted-foreground">Paid</th>
                      <th className="py-3 px-4 text-right font-black uppercase tracking-wider text-xs text-muted-foreground">Balance</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                   {reportData.rows.map(row => (
                      <tr key={row.client.id} className="hover:bg-card/50 transition-colors">
                         <td className="py-3 px-4 font-bold">{row.client.name}</td>
                         <td className={cn("py-3 px-4 text-right font-mono text-muted-foreground", row.openingBalance !== 0 && "text-foreground")}>
                            R {row.openingBalance.toLocaleString()}
                         </td>
                         <td className="py-3 px-4 text-center font-mono text-muted-foreground">{row.sessionCount}</td>
                         <td className="py-3 px-4 text-right font-mono">R {row.fees.toLocaleString()}</td>
                         <td className="py-3 px-4 text-right font-mono text-blue-400">R {row.credits.toLocaleString()}</td>
                         <td className="py-3 px-4 text-right font-mono text-emerald-500 font-bold">R {row.payments.toLocaleString()}</td>
                         <td className={cn("py-3 px-4 text-right font-mono font-black", row.balance > 0 ? "text-red-500" : "text-muted-foreground")}>
                            R {row.balance.toLocaleString()}
                         </td>
                      </tr>
                   ))}
                   {reportData.rows.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-muted-foreground italic">No data for this period.</td></tr>
                   )}
                </tbody>
                <tfoot className="bg-card border-t border-border">
                   <tr>
                      <td className="py-4 px-4 font-black uppercase tracking-widest">Grand Total</td>
                      <td className="py-4 px-4 text-right font-black font-mono text-muted-foreground">R {reportData.totals.openingBalance.toLocaleString()}</td>
                      <td className="py-4 px-4 text-center font-black font-mono">{reportData.totals.count}</td>
                      <td className="py-4 px-4 text-right font-black font-mono text-lg">R {reportData.totals.fees.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right font-black font-mono text-lg text-blue-400">R {reportData.totals.credits.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right font-black font-mono text-lg text-emerald-500">R {reportData.totals.payments.toLocaleString()}</td>
                      <td className={cn("py-4 px-4 text-right font-black font-mono text-xl", reportData.totals.balance > 0 ? "text-red-500" : "text-foreground")}>
                         R {reportData.totals.balance.toLocaleString()}
                      </td>
                   </tr>
                </tfoot>
             </table>
          </div>
       </div>
    </div>
  );
}

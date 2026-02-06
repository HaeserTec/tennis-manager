import React, { useState } from 'react';
import { 
  Search, ChevronLeft, ChevronRight, CreditCard, Users, MapPin, 
  Plus, Phone, Mail, Edit3, ArrowUpRight, ArrowDownRight, Wallet
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, nanoid } from '@/lib/utils';
import type { Client, Player, TrainingSession } from '@/lib/playbook';
import { useClientFinancials, useFilteredClients, useLedgerEntries } from '@/lib/hooks';

interface FinancialWorkspaceProps {
  clients: Client[];
  players: Player[];
  sessions: TrainingSession[];
  onUpsertClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
}

export function FinancialWorkspace({
  clients,
  players,
  sessions,
  onUpsertClient,
  onEditClient,
}: FinancialWorkspaceProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Get financial data
  const { clients: clientFinancials, totals } = useClientFinancials(
    clients, players, sessions, currentDate
  );
  
  const filteredClients = useFilteredClients(
    clientFinancials, searchQuery, locationFilter
  );
  
  const ledgerEntries = useLedgerEntries(clientFinancials, selectedClientId);

  // Get selected client
  const selectedClient = clientFinancials.find(c => c.client.id === selectedClientId);

  // Handle payment recording
  const handleRecordPayment = () => {
    if (!selectedClient || !paymentAmount) return;
    
    const client = selectedClient.client;
    const newPayment = {
      id: nanoid(),
      date: paymentDate,
      amount: parseFloat(paymentAmount),
      reference: paymentRef || undefined,
    };
    
    onUpsertClient({
      ...client,
      payments: [...(client.payments || []), newPayment],
      updatedAt: Date.now(),
    });
    
    setPaymentAmount('');
    setPaymentRef('');
    setIsAddPaymentOpen(false);
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-card/30">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Finance & Clients
          </h2>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
            {selectedClient ? `Viewing: ${selectedClient.client.name}` : 'All Clients'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center bg-card border border-border rounded-lg p-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-3 font-bold text-xs min-w-[100px] text-center">
              {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Location Filter */}
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs bg-card">
              <MapPin className="w-3 h-3 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Locations</SelectItem>
              <SelectItem value="Bothaville">Bothaville</SelectItem>
              <SelectItem value="Kroonstad">Kroonstad</SelectItem>
              <SelectItem value="Welkom">Welkom</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search clients..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-8 w-48 h-8 text-xs bg-card border-border" 
            />
          </div>
          
          {/* Clear Selection */}
          {selectedClientId && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedClientId(null)}
              className="h-8 text-xs"
            >
              View All
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Master Client Table */}
        <div className="w-[55%] flex flex-col border-r border-border">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3 p-4 border-b border-border bg-card/20">
            <SummaryCard 
              label="Brought Forward" 
              value={totals.openingBalance} 
              className="text-muted-foreground"
            />
            <SummaryCard 
              label="Monthly Fees" 
              value={totals.monthlyFees} 
              className="text-amber-500"
              icon={<ArrowUpRight className="w-3 h-3" />}
            />
            <SummaryCard 
              label="Received" 
              value={totals.monthlyPayments} 
              className="text-emerald-500"
              icon={<ArrowDownRight className="w-3 h-3" />}
            />
            <SummaryCard 
              label="Net Balance" 
              value={totals.closingBalance} 
              className={totals.closingBalance > 0 ? 'text-red-500' : 'text-emerald-500'}
              highlight
            />
          </div>

          {/* Client Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-card/50 sticky top-0 z-10">
                <tr className="border-b border-border">
                  <th className="py-2.5 px-3 text-left font-black uppercase tracking-wider text-[10px] text-muted-foreground">Client</th>
                  <th className="py-2.5 px-2 text-center font-black uppercase tracking-wider text-[10px] text-muted-foreground">
                    <Users className="w-3 h-3 inline" />
                  </th>
                  <th className="py-2.5 px-2 text-center font-black uppercase tracking-wider text-[10px] text-muted-foreground">Loc</th>
                  <th className="py-2.5 px-2 text-right font-black uppercase tracking-wider text-[10px] text-muted-foreground">B/F</th>
                  <th className="py-2.5 px-2 text-right font-black uppercase tracking-wider text-[10px] text-muted-foreground">Fees</th>
                  <th className="py-2.5 px-2 text-right font-black uppercase tracking-wider text-[10px] text-muted-foreground">Paid</th>
                  <th className="py-2.5 px-3 text-right font-black uppercase tracking-wider text-[10px] text-muted-foreground">Balance</th>
                  <th className="py-2.5 px-2 text-center font-black uppercase tracking-wider text-[10px] text-muted-foreground">Act</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredClients.map(cf => (
                  <tr 
                    key={cf.client.id} 
                    className={cn(
                      "hover:bg-card/50 transition-colors cursor-pointer",
                      selectedClientId === cf.client.id && "bg-primary/10 hover:bg-primary/15"
                    )}
                    onClick={() => setSelectedClientId(cf.client.id)}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-bold">{cf.client.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {cf.client.phone && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            {cf.client.phone}
                          </span>
                        )}
                        {cf.client.email && (
                          <span className="flex items-center gap-0.5">
                            <Mail className="w-2.5 h-2.5" />
                            {cf.client.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-muted-foreground">{cf.playerCount}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="text-[10px] font-medium text-muted-foreground">{cf.location}</span>
                    </td>
                    <td className={cn("py-2.5 px-2 text-right font-mono", cf.openingBalance !== 0 && "text-foreground")}>
                      {cf.openingBalance !== 0 ? `R ${cf.openingBalance.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-amber-500">
                      R {cf.monthlyFees.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-500">
                      {cf.monthlyPayments > 0 ? `R ${cf.monthlyPayments.toLocaleString()}` : '-'}
                    </td>
                    <td className={cn(
                      "py-2.5 px-3 text-right font-mono font-bold",
                      cf.closingBalance > 0 ? "text-red-500" : "text-emerald-500"
                    )}>
                      R {cf.closingBalance.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditClient(cf.client);
                          }}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-primary hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClientId(cf.client.id);
                            setIsAddPaymentOpen(true);
                          }}
                        >
                          <CreditCard className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground italic">
                      No clients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel - Contextual Ledger */}
        <div className="flex-1 flex flex-col bg-card/10">
          {/* Ledger Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                {selectedClient ? `Ledger: ${selectedClient.client.name}` : 'Global Ledger'}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {selectedClient 
                  ? `${ledgerEntries.length} transactions this month` 
                  : `${ledgerEntries.length} total transactions`}
              </p>
            </div>
            {selectedClient && (
              <Button 
                size="sm" 
                className="h-7 text-xs gap-1"
                onClick={() => setIsAddPaymentOpen(true)}
              >
                <Plus className="w-3 h-3" />
                Record Payment
              </Button>
            )}
          </div>

          {/* Ledger Entries */}
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-2">
              {ledgerEntries.map(entry => (
                <div 
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      entry.type === 'payment' 
                        ? "bg-emerald-500/10 text-emerald-500" 
                        : "bg-amber-500/10 text-amber-500"
                    )}>
                      {entry.type === 'payment' ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-xs">{entry.description}</div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{entry.date}</span>
                        {!selectedClient && (
                          <>
                            <span>•</span>
                            <span>{entry.clientName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "font-mono font-bold text-sm",
                    entry.type === 'payment' ? "text-emerald-500" : "text-amber-500"
                  )}>
                    {entry.type === 'payment' ? '+' : ''}
                    R {Math.abs(entry.amount).toLocaleString()}
                  </div>
                </div>
              ))}
              {ledgerEntries.length === 0 && (
                <div className="py-8 text-center text-muted-foreground italic text-sm">
                  No transactions for this period.
                </div>
              )}
            </div>
          </div>

          {/* Running Balance */}
          {ledgerEntries.length > 0 && (
            <div className="p-4 border-t border-border bg-card/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Net Activity
                </span>
                <span className={cn(
                  "font-mono font-bold",
                  ledgerEntries.reduce((sum, e) => sum + e.amount, 0) >= 0 
                    ? "text-emerald-500" 
                    : "text-red-500"
                )}>
                  {ledgerEntries.reduce((sum, e) => sum + e.amount, 0) >= 0 ? '+' : ''}
                  R {ledgerEntries.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Payment Modal */}
      {isAddPaymentOpen && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold">Record Payment</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsAddPaymentOpen(false)}>
                ×
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Client</div>
                <div className="font-bold">{selectedClient.client.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Current Balance: R {selectedClient.closingBalance.toLocaleString()}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Amount (R)
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Reference (Optional)
                </label>
                <Input
                  placeholder="e.g., EFT Term 1, Cash"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                />
              </div>
            </div>
            <div className="p-5 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddPaymentOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRecordPayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Summary Card Component
function SummaryCard({ 
  label, 
  value, 
  className,
  icon,
  highlight = false 
}: { 
  label: string; 
  value: number; 
  className?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "p-3 rounded-lg border",
      highlight ? "bg-card border-primary/30" : "bg-card/50 border-border/50"
    )}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn(
        "font-mono font-bold text-lg mt-1 flex items-center gap-1",
        className
      )}>
        {icon}
        R {value.toLocaleString()}
      </div>
    </div>
  );
}

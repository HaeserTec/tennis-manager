import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ChevronLeft, ChevronRight, CreditCard, MapPin,
  Plus, Phone, Mail, Edit3, ArrowUpRight, ArrowDownRight, Wallet, ListFilter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, nanoid, toLocalISODate } from '@/lib/utils';
import type { Client, Player, TrainingSession, DayEvent } from '@/lib/playbook';
import { useClientFinancials, useFilteredClients, useLedgerEntries } from '@/lib/hooks';

interface FinancialWorkspaceProps {
  clients: Client[];
  players: Player[];
  sessions: TrainingSession[];
  dayEvents?: DayEvent[];
  onUpsertClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onUploadFile?: (bucket: string, file: File) => Promise<string | null>;
}

type SortMode = 'balance-desc' | 'name-asc' | 'fees-desc';
type LedgerFilter = 'all' | 'charges' | 'credits';
type DensityMode = 'compact' | 'comfortable';

type ThreadMessage = {
  id: string;
  author: 'coach' | 'parent';
  text: string;
  createdAt: number;
};

type MessageMeta = {
  unreadCount: number;
  lastAuthor: 'coach' | 'parent' | null;
  lastCreatedAt: number | null;
  lastPreview: string;
};

export function FinancialWorkspace({
  clients,
  players,
  sessions,
  dayEvents = [],
  onUpsertClient,
  onEditClient,
  onUploadFile,
}: FinancialWorkspaceProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(toLocalISODate(new Date()));
  const [paymentPlayerId, setPaymentPlayerId] = useState<string>('household');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofName, setPaymentProofName] = useState('');
  const [showOutstandingOnly, setShowOutstandingOnly] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('balance-desc');
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [densityMode, setDensityMode] = useState<DensityMode>('comfortable');
  const [messageMetaByClient, setMessageMetaByClient] = useState<Record<string, MessageMeta>>({});
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 56;
    const saved = Number(window.localStorage.getItem('tactics-lab-financials-left-pane'));
    return Number.isFinite(saved) ? Math.min(72, Math.max(38, saved)) : 56;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('tactics-lab-financials-left-pane', String(leftPaneWidth));
  }, [leftPaneWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (event: PointerEvent) => {
      if (!containerRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      if (bounds.width <= 0) return;
      const ratio = ((event.clientX - bounds.left) / bounds.width) * 100;
      setLeftPaneWidth(Math.min(72, Math.max(38, ratio)));
    };
    const onUp = () => setIsResizing(false);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isResizing]);

  const onResizeStart = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setIsResizing(true);
  }, []);

  const refreshMessageMeta = useCallback(() => {
    if (typeof window === 'undefined') return;
    const next: Record<string, MessageMeta> = {};
    for (const client of clients) {
      const threadKey = `tl-client-messages-${client.id}`;
      const readKey = `tl-client-messages-read-coach-${client.id}`;
      const raw = window.localStorage.getItem(threadKey);
      const readAt = Number(window.localStorage.getItem(readKey) || '0');
      let messages: ThreadMessage[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ThreadMessage[];
          if (Array.isArray(parsed)) {
            messages = parsed.filter((m) => m && (m.author === 'coach' || m.author === 'parent') && typeof m.createdAt === 'number');
          }
        } catch {
          messages = [];
        }
      }
      messages.sort((a, b) => b.createdAt - a.createdAt);
      const last = messages[0];
      const unreadCount = messages.filter((m) => m.author === 'parent' && m.createdAt > readAt).length;
      next[client.id] = {
        unreadCount,
        lastAuthor: last?.author || null,
        lastCreatedAt: last?.createdAt || null,
        lastPreview: (last?.text || '').slice(0, 72)
      };
    }
    setMessageMetaByClient(next);
  }, [clients]);

  const markCoachThreadRead = useCallback((clientId: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`tl-client-messages-read-coach-${clientId}`, String(Date.now()));
    window.dispatchEvent(new Event('tl-messages-updated'));
  }, []);

  useEffect(() => {
    refreshMessageMeta();
  }, [refreshMessageMeta]);

  useEffect(() => {
    const onUpdated = () => refreshMessageMeta();
    window.addEventListener('storage', onUpdated);
    window.addEventListener('tl-messages-updated', onUpdated);
    const t = window.setInterval(refreshMessageMeta, 10000);
    return () => {
      window.removeEventListener('storage', onUpdated);
      window.removeEventListener('tl-messages-updated', onUpdated);
      window.clearInterval(t);
    };
  }, [refreshMessageMeta]);

  const { clients: clientFinancials, totals } = useClientFinancials(
    clients, players, sessions, dayEvents, currentDate
  );
  const filteredClients = useFilteredClients(
    clientFinancials, searchQuery, locationFilter
  );

  const scopedClients = useMemo(() => {
    let list = filteredClients;
    if (showOutstandingOnly) list = list.filter((c) => c.closingBalance > 0);
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortMode === 'name-asc') return a.client.name.localeCompare(b.client.name);
      if (sortMode === 'fees-desc') return b.monthlyFees - a.monthlyFees;
      return b.closingBalance - a.closingBalance;
    });
    return sorted;
  }, [filteredClients, showOutstandingOnly, sortMode]);

  const allLedgerEntries = useLedgerEntries(
    clientFinancials, null, players, sessions, dayEvents, currentDate
  );
  const clientLedgerEntries = useLedgerEntries(
    clientFinancials, selectedClientId, players, sessions, dayEvents, currentDate
  );

  const displayedLedgerEntries = useMemo(() => {
    if (ledgerFilter === 'charges') return clientLedgerEntries.filter((e) => e.amount > 0);
    if (ledgerFilter === 'credits') return clientLedgerEntries.filter((e) => e.amount < 0);
    return clientLedgerEntries;
  }, [clientLedgerEntries, ledgerFilter]);

  const selectedClient = clientFinancials.find(c => c.client.id === selectedClientId);
  const openAccountsCount = useMemo(
    () => clientFinancials.filter(c => c.closingBalance > 0).length,
    [clientFinancials]
  );

  const topOverdue = useMemo(() => {
    return [...clientFinancials]
      .filter(c => c.closingBalance > 0)
      .sort((a, b) => b.closingBalance - a.closingBalance)
      .slice(0, 5);
  }, [clientFinancials]);

  const creditEventsTotal = useMemo(() => {
    return allLedgerEntries
      .filter((e) => e.description.toLowerCase().includes('credit'))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }, [allLedgerEntries]);

  const handleRecordPayment = async () => {
    if (!selectedClient || !paymentAmount) return;
    const client = selectedClient.client;
    let proofUrl: string | undefined;
    if (paymentProofFile) {
      if (onUploadFile) {
        proofUrl = (await onUploadFile('session-media', paymentProofFile)) || undefined;
      } else {
        proofUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(paymentProofFile);
        });
      }
    }
    const newPayment = {
      id: nanoid(),
      date: paymentDate,
      amount: parseFloat(paymentAmount),
      reference: paymentRef || undefined,
      playerId: paymentPlayerId !== 'household' ? paymentPlayerId : undefined,
      proofUrl,
      proofName: paymentProofName || paymentProofFile?.name || undefined,
    };
    onUpsertClient({
      ...client,
      payments: [...(client.payments || []), newPayment],
      updatedAt: Date.now(),
    });
    setPaymentAmount('');
    setPaymentRef('');
    setPaymentPlayerId('household');
    setPaymentProofFile(null);
    setPaymentProofName('');
    setIsAddPaymentOpen(false);
  };

  return (
    <div className="app-page h-full flex flex-col text-foreground">
      <div className="app-topbar p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="app-heading-lg app-title uppercase flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Finance Workspace
            </h2>
            <p className="app-kicker mt-1">
              {selectedClient ? `Focus: ${selectedClient.client.name}` : 'Portfolio Overview'}
            </p>
          </div>
          <div className="app-card flex items-center rounded-lg p-1 shrink-0">
            <Button variant="ghost" size="icon" className="tap-target-icon h-9 w-9 sm:h-7 sm:w-7" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-3 font-bold text-xs min-w-[100px] text-center">
              {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
            </div>
            <Button variant="ghost" size="icon" className="tap-target-icon h-9 w-9 sm:h-7 sm:w-7" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <MetricCard label="Opening" value={totals.openingBalance} className="text-muted-foreground" />
          <MetricCard label="Charges" value={totals.monthlyFees} className="text-amber-500" icon={<ArrowUpRight className="w-3 h-3" />} />
          <MetricCard label="Payments" value={totals.monthlyPayments} className="text-emerald-500" icon={<ArrowDownRight className="w-3 h-3" />} />
          <MetricCard label="Net Balance" value={totals.closingBalance} className={totals.closingBalance > 0 ? 'text-red-500' : 'text-emerald-500'} highlight />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[auto_auto_auto_1fr_auto] gap-2 items-center">
          <div className="relative min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search clients..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 w-full sm:w-56 h-9 sm:h-8 text-xs app-card border-border" />
          </div>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 sm:h-8 text-xs bg-card">
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
          <Select value={sortMode} onValueChange={(v: SortMode) => setSortMode(v)}>
            <SelectTrigger className="w-full sm:w-[170px] h-9 sm:h-8 text-xs bg-card">
              <ListFilter className="w-3 h-3 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balance-desc">Sort: Highest Balance</SelectItem>
              <SelectItem value="fees-desc">Sort: Highest Charges</SelectItem>
              <SelectItem value="name-asc">Sort: Client Name</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant={showOutstandingOnly ? 'secondary' : 'outline'} className="tap-target h-9 sm:h-8 text-xs w-full sm:w-auto" onClick={() => setShowOutstandingOnly((v) => !v)}>
            {showOutstandingOnly ? 'Showing Outstanding Only' : 'Showing All Clients'}
          </Button>
          <div className="sm:ml-auto flex items-center gap-1 rounded-lg border border-border bg-card/80 p-1 justify-center sm:justify-start">
            <Button
              size="sm"
              variant={densityMode === 'compact' ? 'secondary' : 'ghost'}
              className="h-7 text-[11px] px-2"
              onClick={() => setDensityMode('compact')}
            >
              Compact
            </Button>
            <Button
              size="sm"
              variant={densityMode === 'comfortable' ? 'secondary' : 'ghost'}
              className="h-7 text-[11px] px-2"
              onClick={() => setDensityMode('comfortable')}
            >
              Comfortable
            </Button>
          </div>
          {selectedClientId && (
            <Button size="sm" variant="outline" className="tap-target h-9 sm:h-8 text-xs w-full sm:w-auto" onClick={() => setSelectedClientId(null)}>
              Clear Focus
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="app-chip px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/90">
            {scopedClients.length} clients shown
          </div>
          <div className="app-chip px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/90">
            {openAccountsCount} open accounts
          </div>
          <div className="app-chip px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/90">
            {selectedClient ? `${displayedLedgerEntries.length} ledger lines` : 'Select a client for ledger'}
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div
          style={{ width: `${leftPaneWidth}%` }}
          className="w-full lg:w-auto lg:min-w-[420px] lg:max-w-[72%] border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-[260px] lg:min-h-0"
        >
          <div className="overflow-x-auto">
            <div className="app-table-head min-w-[560px] sm:min-w-[640px] grid grid-cols-[1.8fr_60px_100px_90px_80px] sm:grid-cols-[1.8fr_70px_110px_100px_90px] px-3 sm:px-4 py-2.5 sticky top-0 z-20 backdrop-blur">
              <div>Client</div>
              <div className="text-center">Players</div>
              <div className="text-right">Charges</div>
              <div className="text-right">Balance</div>
              <div className="text-center">Action</div>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="min-w-[560px] sm:min-w-[640px]">
              {scopedClients.map((cf) => {
                const meta = messageMetaByClient[cf.client.id];
                return (
                  <div
                    key={cf.client.id}
                    onClick={() => {
                      setSelectedClientId(cf.client.id);
                      markCoachThreadRead(cf.client.id);
                    }}
                    className={cn(
                      "app-table-row grid grid-cols-[1.8fr_60px_100px_90px_80px] sm:grid-cols-[1.8fr_70px_110px_100px_90px] items-center px-3 sm:px-4 cursor-pointer",
                      densityMode === 'compact' ? "py-2.5" : "py-3.5",
                      selectedClientId === cf.client.id && "bg-primary/10"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("font-semibold truncate tracking-tight", densityMode === 'compact' ? "text-xs" : "text-sm")}>{cf.client.name}</div>
                        {(meta?.unreadCount || 0) > 0 && (
                          <span className="shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 font-black">
                            {meta.unreadCount} new
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground/90 flex gap-2 mt-0.5 items-center">
                        {cf.location && <span className="px-1.5 py-0.5 rounded bg-secondary/55 border border-border/50 uppercase tracking-wide text-muted-foreground/95">{cf.location}</span>}
                        {cf.client.phone && <span className="truncate flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{cf.client.phone}</span>}
                        {cf.client.email && <span className="truncate flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{cf.client.email}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground/90 mt-0.5 truncate">
                        {meta?.lastAuthor
                          ? `Last message: ${meta.lastAuthor === 'parent' ? 'Parent' : 'Coach'}${meta.lastPreview ? ` - ${meta.lastPreview}` : ''}`
                          : 'No messages yet'}
                      </div>
                    </div>
                    <div className="text-center text-xs font-mono text-muted-foreground">{cf.playerCount}</div>
                    <div className="text-right font-mono text-xs text-amber-500">R {cf.monthlyFees.toLocaleString()}</div>
                    <div className={cn(
                      "text-right font-mono text-xs font-bold",
                      cf.closingBalance > 0 ? "text-red-500" : "text-emerald-500"
                    )}>
                      R {cf.closingBalance.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="tap-target-icon h-9 w-9 sm:h-7 sm:w-7" onClick={(e) => { e.stopPropagation(); markCoachThreadRead(cf.client.id); onEditClient(cf.client); }}>
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="tap-target-icon h-9 w-9 sm:h-7 sm:w-7 text-primary hover:text-primary" onClick={(e) => { e.stopPropagation(); setSelectedClientId(cf.client.id); setIsAddPaymentOpen(true); }}>
                        <CreditCard className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {scopedClients.length === 0 && (
                <div className="py-12 text-center text-muted-foreground italic text-sm">
                  No clients match this filter.
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          role="separator"
          aria-label="Resize financial panes"
          aria-orientation="vertical"
          onPointerDown={onResizeStart}
          className="hidden lg:block w-1 cursor-col-resize bg-transparent hover:bg-primary/40 transition-colors"
        />

        <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-card/10">
          {selectedClient ? (
            <>
              <div className="p-3 sm:p-4 border-b border-border bg-card/35 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="app-heading-md tracking-tight">{selectedClient.client.name}</h3>
                    <p className="app-kicker mt-1">Focused ledger</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="tap-target h-9 sm:h-7 text-xs" onClick={() => onEditClient(selectedClient.client)}>
                      Edit
                    </Button>
                    <Button size="sm" className="tap-target h-9 sm:h-7 text-xs gap-1" onClick={() => setIsAddPaymentOpen(true)}>
                      <Plus className="w-3 h-3" /> Record Payment
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                  <MiniValue label="B/F" value={selectedClient.openingBalance} className="text-muted-foreground" />
                  <MiniValue label="Charges" value={selectedClient.monthlyFees} className="text-amber-500" />
                  <MiniValue label="Paid" value={selectedClient.monthlyPayments} className="text-emerald-500" />
                  <MiniValue label="Balance" value={selectedClient.closingBalance} className={selectedClient.closingBalance > 0 ? "text-red-500" : "text-emerald-500"} />
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant={ledgerFilter === 'all' ? 'secondary' : 'outline'} className="tap-target h-9 sm:h-7 text-xs" onClick={() => setLedgerFilter('all')}>All</Button>
                  <Button size="sm" variant={ledgerFilter === 'charges' ? 'secondary' : 'outline'} className="tap-target h-9 sm:h-7 text-xs" onClick={() => setLedgerFilter('charges')}>Charges</Button>
                  <Button size="sm" variant={ledgerFilter === 'credits' ? 'secondary' : 'outline'} className="tap-target h-9 sm:h-7 text-xs" onClick={() => setLedgerFilter('credits')}>Credits/Payments</Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-2">
                <div className="sticky top-0 z-10 app-table-head border border-border/60 rounded-lg px-2.5 sm:px-3 py-2.5 grid grid-cols-[86px_1fr_120px] sm:grid-cols-[120px_1fr_140px] gap-2">
                  <div>Date</div>
                  <div>Description</div>
                  <div className="text-right">Amount</div>
                </div>
                {displayedLedgerEntries.map(entry => (
                  <div
                    key={entry.id}
                    className={cn(
                      "app-table-row flex items-center justify-between rounded-lg bg-card/50 border border-border/50",
                      densityMode === 'compact' ? "p-2.5" : "p-3.5"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        entry.amount < 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {entry.amount < 0 ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1 grid grid-cols-[86px_1fr] sm:grid-cols-[120px_1fr] gap-2 items-center">
                        <div className="text-[10px] text-muted-foreground font-mono">{entry.date}</div>
                        <div className={cn("font-medium truncate text-foreground/95", densityMode === 'compact' ? "text-[11px]" : "text-xs")}>{entry.description}</div>
                      </div>
                    </div>
                    <div className={cn(
                      "font-mono font-bold shrink-0",
                      densityMode === 'compact' ? "text-xs" : "text-sm",
                      entry.amount < 0 ? "text-emerald-500" : "text-amber-500"
                    )}>
                      {entry.amount < 0 ? '+' : '-'} R {Math.abs(entry.amount).toLocaleString()}
                    </div>
                  </div>
                ))}
                {displayedLedgerEntries.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground italic text-sm">No transactions in this filter.</div>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 space-y-6 overflow-auto">
              <div className="app-card p-5 rounded-xl">
                <h3 className="app-heading-md mb-3">Top Outstanding Balances</h3>
                <div className="space-y-2">
                  {topOverdue.map((item) => {
                    const meta = messageMetaByClient[item.client.id];
                    return (
                    <button
                      key={item.client.id}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-card transition-colors text-left app-card-hover"
                      onClick={() => {
                        setSelectedClientId(item.client.id);
                        markCoachThreadRead(item.client.id);
                      }}
                    >
                      <div className="text-xs font-medium truncate text-foreground/95 flex items-center gap-1.5">
                        {item.client.name}
                        {(meta?.unreadCount || 0) > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />}
                      </div>
                      <div className="text-xs font-mono font-bold text-red-500">R {item.closingBalance.toLocaleString()}</div>
                    </button>
                    );
                  })}
                  {topOverdue.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">No outstanding balances this month.</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="app-card p-4 rounded-xl">
                  <div className="app-kicker">Credit Events</div>
                  <div className="text-xl font-black text-blue-400 mt-1">R {creditEventsTotal.toLocaleString()}</div>
                </div>
                <div className="app-card p-4 rounded-xl">
                  <div className="app-kicker">Open Accounts</div>
                  <div className="text-xl font-black mt-1">{openAccountsCount}</div>
                </div>
              </div>

              <div className="app-card p-4 rounded-xl text-xs app-muted-readable">
                Select a client on the left to open focused ledger mode and record payments quickly.
              </div>
            </div>
          )}
        </div>
      </div>

      {isAddPaymentOpen && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="app-card w-full max-w-md rounded-2xl shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold">Record Payment</h3>
              <Button variant="ghost" size="icon" className="tap-target-icon" onClick={() => setIsAddPaymentOpen(false)}>×</Button>
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
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amount (R)</label>
                  <Input type="number" placeholder="0.00" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</label>
                  <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reference (Optional)</label>
                <Input placeholder="e.g., EFT Term 1, Cash" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Allocate To</label>
                <Select value={paymentPlayerId} onValueChange={setPaymentPlayerId}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="household">Household (All Kids)</SelectItem>
                    {players.filter(p => p.clientId === selectedClient.client.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Proof Of Payment (Optional)</label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)} className="h-10" />
                <Input placeholder="Proof label (optional)" value={paymentProofName} onChange={e => setPaymentProofName(e.target.value)} />
              </div>
            </div>
            <div className="p-5 border-t border-border flex justify-end gap-2">
              <Button variant="outline" className="tap-target" onClick={() => setIsAddPaymentOpen(false)}>Cancel</Button>
              <Button className="tap-target" onClick={handleRecordPayment} disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}>Record Payment</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
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
      "app-card p-3 rounded-lg border",
      highlight ? "border-primary/35" : "border-border/50"
    )}>
      <div className="app-kicker">{label}</div>
      <div className={cn("font-mono font-bold text-lg mt-1 flex items-center gap-1", className)}>
        {icon}
        R {value.toLocaleString()}
      </div>
    </div>
  );
}

function MiniValue({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="app-card p-2 rounded-lg border-border/50">
      <div className="app-kicker">{label}</div>
      <div className={cn("font-mono font-bold text-sm mt-0.5", className)}>R {value.toLocaleString()}</div>
    </div>
  );
}

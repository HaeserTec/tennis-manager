import React, { useMemo, useState } from 'react';
import { Player, TrainingSession, Client, Expense } from '@/lib/playbook';
import { calculateDashboardStats, getRevenueChartData, getHeatmapData, getClientHealth, DashboardStats } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { Activity, TrendingUp, TrendingDown, Users, Calendar, AlertTriangle, CheckCircle, BarChart3, PieChart, Clock, Zap, Heart, Wallet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface InsightsDashboardProps {
  players: Player[];
  sessions: TrainingSession[];
  clients: Client[];
  expenses: Expense[];
}

export function InsightsDashboard({ players, sessions, clients, expenses }: InsightsDashboardProps) {
  const [chartPeriod, setChartPeriod] = useState<'week'|'month'|'year'>('month');
  
  const stats = useMemo(() => calculateDashboardStats(players, sessions, clients, expenses), [players, sessions, clients, expenses]);
  const chartData = useMemo(() => getRevenueChartData(sessions, chartPeriod), [sessions, chartPeriod]);
  const hasRevenueValues = useMemo(() => chartData.some(d => d.value > 0), [chartData]);
  const heatmapData = useMemo(() => getHeatmapData(sessions), [sessions]);
  const clientHealth = useMemo(() => getClientHealth(players, sessions), [players, sessions]);
  
  const sessionBreakdown = useMemo(() => {
     const counts = { Private: 0, Semi: 0, Group: 0 };
     sessions.forEach(s => {
        const type = s.type === 'Private' ? 'Private' : s.type === 'Semi' ? 'Semi' : 'Group';
        counts[type] = (counts[type] || 0) + 1;
     });
     const total = sessions.length || 1;
     return { counts, total };
  }, [sessions]);

  return (
    <div className="p-6 space-y-8 pb-20 overflow-y-auto h-full custom-scrollbar">
      
      {/* Header */}
      <div className="flex items-center justify-between">
         <div>
            <h2 className="text-3xl font-black flex items-center gap-3 tracking-tight">
               <span className="w-1.5 h-8 bg-gradient-to-b from-primary to-purple-500 rounded-full"></span>
               Business Insights
               <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                  AI-Powered
               </span>
            </h2>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Real-time analytics and intelligent recommendations</p>
         </div>
         <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Last updated</p>
            <p className="text-sm font-mono font-medium opacity-80">{new Date().toLocaleTimeString()}</p>
         </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <RevenueCard stats={stats} />
         <CashFlowCard stats={stats} />
         <StatCard 
            title="Total Sessions" 
            value={stats.totalSessions.toString()} 
            trend={stats.sessionsChange} 
            icon={<Calendar className="w-5 h-5 text-blue-400" />}
            color="blue"
            delay={100}
         />
         <StatCard 
            title="Active Clients" 
            value={stats.activeClients.toString()} 
            trend={stats.clientGrowth} 
            icon={<Users className="w-5 h-5 text-purple-400" />}
            color="purple"
            delay={200}
            subtext={`+${stats.clientGrowth} this month`}
         />
      </div>

      {/* Main Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 p-6 rounded-2xl bg-card/30 backdrop-blur border border-white/5 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-6 relative z-10">
               <h3 className="text-lg font-bold flex items-center gap-2 uppercase tracking-tighter">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Revenue Trend
               </h3>
               <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
                  {(['week', 'month', 'year'] as const).map((p) => (
                     <button
                        key={p}
                        onClick={() => setChartPeriod(p)}
                        className={cn(
                           "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                           chartPeriod === p ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-white/5"
                        )}
                     >
                        {p}
                     </button>
                  ))}
               </div>
            </div>

            <div className="h-64 flex items-end gap-2 px-2 relative z-10">
               {chartData.map((d, i) => {
                  const max = Math.max(...chartData.map(x => x.value), 1);
                  const h = (d.value / max) * 100;
                  return (
                     <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group/bar">
                        <div className="w-full relative flex-1 flex items-end min-h-[140px]">
                           {d.value > 0 && (
                              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-foreground/80 whitespace-nowrap">
                                 R{Math.round(d.value)}
                              </span>
                           )}
                           <div 
                              className="w-full bg-gradient-to-t from-primary/80 to-purple-500 rounded-t-md opacity-80 group-hover/bar:opacity-100 transition-all duration-300"
                              style={{ height: `${Math.max(h, d.value > 0 ? 2 : 0.5)}%`, animationDelay: `${i * 50}ms` }}
                           ></div>
                        </div>
                        <span className="text-[10px] text-muted-foreground group-hover/bar:text-foreground font-mono transition-colors">{d.label}</span>
                     </div>
                  )
               })}
            </div>
            {!hasRevenueValues && (
               <div className="text-xs text-amber-300/90 mt-3 px-2">
                  No billable values in this period. Switch period or add prices to sessions.
               </div>
            )}
         </div>

         <div className="p-6 rounded-2xl bg-card/30 backdrop-blur border border-white/5 shadow-xl flex flex-col items-center justify-center relative">
            <h3 className="w-full text-lg font-bold flex items-center gap-2 mb-6 uppercase tracking-tighter">
               <PieChart className="w-5 h-5 text-purple-400" />
               Session Mix
            </h3>
            
            <div className="relative w-48 h-48">
               <svg className="w-full h-full transform -rotate-90">
                  <circle cx="96" cy="96" r="80" fill="none" stroke="currentColor" strokeWidth="12" className="text-secondary" />
                  <circle cx="96" cy="96" r="80" fill="none" stroke="#10b981" strokeWidth="12" 
                     strokeDasharray={`${(sessionBreakdown.counts.Private / sessionBreakdown.total) * 502} 502`} 
                     className="health-ring" />
                  <circle cx="96" cy="96" r="80" fill="none" stroke="#f59e0b" strokeWidth="12" 
                     strokeDasharray={`${(sessionBreakdown.counts.Semi / sessionBreakdown.total) * 502} 502`} 
                     strokeDashoffset={`-${(sessionBreakdown.counts.Private / sessionBreakdown.total) * 502}`}
                     className="health-ring" />
                  <circle cx="96" cy="96" r="80" fill="none" stroke="#3b82f6" strokeWidth="12" 
                     strokeDasharray={`${(sessionBreakdown.counts.Group / sessionBreakdown.total) * 502} 502`} 
                     strokeDashoffset={`-${((sessionBreakdown.counts.Private + sessionBreakdown.counts.Semi) / sessionBreakdown.total) * 502}`}
                     className="health-ring" />
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black">{sessionBreakdown.total}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Sessions</span>
               </div>
            </div>

            <div className="w-full mt-8 space-y-3">
               <LegendItem color="bg-emerald-500" label="Private" count={sessionBreakdown.counts.Private} />
               <LegendItem color="bg-amber-500" label="Semi-Private" count={sessionBreakdown.counts.Semi} />
               <LegendItem color="bg-blue-500" label="Group" count={sessionBreakdown.counts.Group} />
            </div>
         </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
         <div className="p-6 rounded-2xl bg-card/30 backdrop-blur border border-white/5 shadow-xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 uppercase tracking-tighter">
               <Zap className="w-5 h-5 text-orange-400" />
               Peak Hours
            </h3>
            <div className="space-y-1">
               {['13:00','14:00','15:00','16:00','17:00','18:00'].map(time => (
                  <div key={time} className="flex gap-1">
                     <div className="w-12 text-[10px] text-muted-foreground font-mono flex items-center">{time}</div>
                     {['Monday','Tuesday','Wednesday','Thursday','Friday'].map(day => {
                        const count = heatmapData[`${day}-${time}:00`] || 0;
                        const opacity = Math.min(count * 0.25, 1);
                        return (
                           <div 
                              key={`${day}-${time}`} 
                              className="flex-1 h-8 rounded bg-primary transition-all hover:scale-110 hover:z-10 relative group cursor-pointer"
                              style={{ backgroundColor: count > 0 ? `rgba(236, 72, 153, ${0.1 + opacity * 0.9})` : 'rgba(255,255,255,0.03)' }}
                           >
                              {count > 0 && (
                                 <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90">
                                    {count}
                                 </div>
                              )}
                           </div>
                        );
                     })}
                  </div>
               ))}
            </div>
            <div className="flex justify-between mt-4 px-12">
               {['Mon','Tue','Wed','Thu','Fri'].map(d => (
                  <span key={d} className="text-[10px] font-bold text-muted-foreground uppercase">{d}</span>
               ))}
            </div>
         </div>

         <div className="p-6 rounded-2xl bg-card/30 backdrop-blur border border-white/5 shadow-xl flex flex-col">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 uppercase tracking-tighter">
               <Heart className="w-5 h-5 text-pink-400" />
               Client Health
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[300px] custom-scrollbar pr-2">
               {clientHealth.slice(0, 10).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                     <div className="relative h-10 w-10 shrink-0">
                         <svg className="w-full h-full transform -rotate-90">
                           <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-secondary" />
                           <circle cx="20" cy="20" r="16" fill="none" stroke={p.healthStatus === 'Healthy' ? '#10b981' : '#f59e0b'} strokeWidth="3" 
                              strokeDasharray={`${(p.healthScore/100)*100} 100`} pathLength="100" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                           {p.healthScore}
                        </div>
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 font-mono">
                           {p.daysSinceLastSession > 30 ? `${p.daysSinceLastSession}d absent` : 'Active'}
                        </div>
                     </div>
                     <div className={cn(
                        "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                        p.healthStatus === 'Healthy' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                     )}>
                        {p.healthStatus}
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>

    </div>
  );
}

function RevenueCard({ stats }: { stats: DashboardStats }) {
   const [view, setView] = useState<'total'|'location'|'type'>('total');

   return (
      <div className="p-6 rounded-2xl bg-card/40 backdrop-blur border border-white/5 shadow-lg relative overflow-hidden group h-[160px] flex flex-col">
         <div className="flex justify-between items-start mb-2 relative z-10 shrink-0">
            <Select value={view} onValueChange={(v: any) => setView(v)}>
               <SelectTrigger className="h-7 w-[140px] text-[10px] font-black uppercase tracking-[0.2em] text-foreground bg-card/50 border border-white/10 hover:bg-white/10 focus:ring-1 focus:ring-primary/50 px-3 shadow-sm rounded-lg transition-all">
                  <SelectValue placeholder="Metric" />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="total">Total Revenue</SelectItem>
                  <SelectItem value="location">By Location</SelectItem>
                  <SelectItem value="type">By Type</SelectItem>
               </SelectContent>
            </Select>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
               <Activity className="w-5 h-5" />
            </div>
         </div>
         
         <div className="relative z-10 flex-1 flex flex-col justify-center">
            {view === 'total' && (
               <>
                  <h3 className="text-2xl font-black tracking-tight">R{stats.realizedRevenue.toLocaleString()}</h3>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                     <span className="text-emerald-400">+R{stats.projectedRevenue.toLocaleString()}</span> Projected (Month)
                  </div>
               </>
            )}

            {view === 'location' && (
               <div className="space-y-1.5 overflow-y-auto custom-scrollbar -mr-2 pr-2 h-full">
                  {Object.entries(stats.revenueByLocation)
                     .sort(([,a], [,b]) => b - a)
                     .map(([loc, val]) => (
                     <div key={loc} className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground truncate max-w-[120px]">{loc}</span>
                        <span className="font-mono font-bold">R{val.toLocaleString()}</span>
                     </div>
                  ))}
                  {Object.keys(stats.revenueByLocation).length === 0 && <span className="text-xs text-muted-foreground italic">No data</span>}
               </div>
            )}

            {view === 'type' && (
               <div className="space-y-1.5 overflow-y-auto custom-scrollbar -mr-2 pr-2 h-full">
                  {Object.entries(stats.revenueByType)
                     .sort(([,a], [,b]) => b - a)
                     .map(([type, val]) => (
                     <div key={type} className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground truncate">{type}</span>
                        <span className="font-mono font-bold">R{val.toLocaleString()}</span>
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>
   );
}

function CashFlowCard({ stats }: { stats: DashboardStats }) {
   const isPositive = stats.netCashFlow >= 0;
   return (
      <div className="p-6 rounded-2xl bg-card/40 backdrop-blur border border-white/5 shadow-lg relative overflow-hidden group h-[160px] flex flex-col">
         <div className="flex justify-between items-start mb-2 relative z-10 shrink-0">
            <div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Cash Flow (YTD)</p>
               <h3 className={cn("text-2xl font-black mt-1 tracking-tight", isPositive ? "text-emerald-400" : "text-rose-400")}>
                  R{stats.netCashFlow.toLocaleString()}
               </h3>
            </div>
            <div className={cn("p-2 rounded-xl ring-1", isPositive ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" : "bg-rose-500/10 text-rose-400 ring-rose-500/20")}>
               <Wallet className="w-5 h-5" />
            </div>
         </div>
         
         <div className="relative z-10 flex-1 flex flex-col justify-center space-y-1">
            <div className="flex justify-between items-center text-xs">
               <span className="text-muted-foreground font-bold uppercase tracking-wider">Collected</span>
               <span className="font-mono font-bold text-emerald-400">+R{stats.totalCashCollected.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
               <span className="text-muted-foreground font-bold uppercase tracking-wider">Expenses</span>
               <span className="font-mono font-bold text-rose-400">-R{stats.totalExpenses.toLocaleString()}</span>
            </div>
         </div>
      </div>
   )
}

function StatCard({ title, value, trend, icon, color, delay, subtext }: any) {
   const isPositive = trend >= 0;
   return (
      <div className="p-6 rounded-2xl bg-card/40 backdrop-blur border border-white/5 shadow-lg relative overflow-hidden group">
         <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
               <h3 className="text-2xl font-black mt-1 tracking-tight">{value}</h3>
            </div>
            <div className={`p-2 rounded-xl bg-${color}-500/10 text-${color}-400 ring-1 ring-${color}-500/20`}>
               {icon}
            </div>
         </div>
         <div className="relative z-10 flex items-center gap-2">
            {subtext && <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">{subtext}</span>}
         </div>
      </div>
   )
}

function LegendItem({ color, label, count }: any) {
   return (
      <div className="flex items-center justify-between text-sm">
         <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", color)} />
            <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">{label}</span>
         </div>
         <span className="font-mono font-bold">{count}</span>
      </div>
   )
}

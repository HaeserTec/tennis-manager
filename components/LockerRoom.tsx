import React, { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, nanoid } from '@/lib/utils';
import type { Player, PlayerStats, Drill, Client } from '@/lib/playbook';
import { RadarChart } from '@/components/RadarChart';
import { AcademyCourtView } from '@/components/AcademyCourtView';

interface LockerRoomProps {
  players: Player[];
  drills: Drill[];
  clients?: Client[];
  onUpdatePlayer: (player: Player) => void;
  onAddPlayer: (player: Player) => void;
  onUpsertClient?: (client: Client) => void;
  onDeletePlayer: (playerId: string) => void;
  onAssignDrill: (playerId: string, drillId: string) => void;
  onUnassignDrill: (playerId: string, drillId: string) => void;
  initialSelectedPlayerId?: string | null;
}

const DEFAULT_STATS: PlayerStats = {
  forehand: 50,
  backhand: 50,
  serve: 50,
  volley: 50,
  movement: 50,
  consistency: 50,
};

const AVATAR_COLORS = [
  "#ff003f", // Neon Red
  "#ffaa00", // Neon Orange
  "#ffff00", // Neon Yellow
  "#39ff14", // Neon Green
  "#00faff", // Neon Blue
  "#4d4dff", // Neon Indigo
  "#d946ef"  // Neon Magenta
];

const getRandomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

export function LockerRoom({ players, drills, clients = [], onUpdatePlayer, onAddPlayer, onUpsertClient, onDeletePlayer, onAssignDrill, onUnassignDrill, initialSelectedPlayerId }: LockerRoomProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const listPanelRef = useRef<HTMLDivElement | null>(null);
  
  // Selection / Batch Mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());

  const [listPanelWidth, setListPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return 360;
    const saved = window.localStorage.getItem('tactics-lab-locker-panel-width');
    const parsed = Number(saved);
    if (!Number.isFinite(parsed)) return 360;
    return Math.min(560, Math.max(260, parsed));
  });
  const [isResizingListPanel, setIsResizingListPanel] = useState(false);

  // Quick Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newParentName, setNewParentName] = useState("");
  const [newParentPhone, setNewParentPhone] = useState("");

  const selectedPlayer = useMemo(() => 
    players.find(p => p.id === selectedPlayerId), 
  [players, selectedPlayerId]);

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return players
      .filter(p => p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, searchQuery]);

  const handleOpenAddModal = () => {
     setNewPlayerName("");
     setNewParentName("");
     setNewParentPhone("");
     setIsAddModalOpen(true);
  };

  const toggleSelectionMode = () => {
     setIsSelectionMode(!isSelectionMode);
     setSelectedPlayerIds(new Set());
     setSelectedPlayerId(null);
  };

  const togglePlayerSelection = (id: string) => {
     const next = new Set(selectedPlayerIds);
     if (next.has(id)) next.delete(id);
     else next.add(id);
     setSelectedPlayerIds(next);
  };

  const handleBulkAssign = (drillId: string) => {
     selectedPlayerIds.forEach(pid => onAssignDrill(pid, drillId));
     alert(`Assigned drill to ${selectedPlayerIds.size} players.`);
     setIsSelectionMode(false);
     setSelectedPlayerIds(new Set());
  };

  const confirmCreatePlayer = () => {
    if (!newPlayerName.trim()) return;

    let linkedClientId: string | undefined;

    // 1. Create Parent Client if provided
    if (newParentName.trim() && onUpsertClient) {
       // Check for existing client (case-insensitive)
       const existing = clients?.find(c => c.name.toLowerCase().trim() === newParentName.toLowerCase().trim());
       
       if (existing) {
          linkedClientId = existing.id;
          // Optionally update phone if provided and existing is empty? 
          // For now, just link to maintain data integrity.
       } else {
          const newClient: Client = {
             id: nanoid(),
             name: newParentName,
             email: "",
             phone: newParentPhone,
             status: "Active",
             createdAt: Date.now(),
             updatedAt: Date.now(),
             payments: []
          };
          onUpsertClient(newClient);
          linkedClientId = newClient.id;
       }
    }

    // 2. Create Player
    const newPlayer: Player = {
      id: nanoid(),
      name: newPlayerName,
      level: "Intermediate",
      clientId: linkedClientId, // Auto-link
      stats: { ...DEFAULT_STATS },
      assignedDrills: [],
      avatarColor: getRandomColor(),
      attendance: [],
      pbs: {},
      dna: { confidence: 5 },
      intel: {
         parentContact: newParentPhone // Legacy fallback
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    onAddPlayer(newPlayer);
    setSelectedPlayerId(newPlayer.id);
    setIsAddModalOpen(false);
  };

  const handleUpdatePlayerPos = (id: string, pos: { x: number, y: number } | undefined) => {
    const player = players.find(p => p.id === id);
    if (player) {
      onUpdatePlayer({ ...player, academyPos: pos, updatedAt: Date.now() });
    }
  };

  React.useEffect(() => {
    if (!initialSelectedPlayerId) return;
    setSelectedPlayerId(initialSelectedPlayerId);
  }, [initialSelectedPlayerId]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('tactics-lab-locker-panel-width', String(listPanelWidth));
  }, [listPanelWidth]);

  React.useEffect(() => {
    if (!isResizingListPanel) return;
    const handleMove = (event: PointerEvent) => {
      if (!listPanelRef.current) return;
      const { left } = listPanelRef.current.getBoundingClientRect();
      const nextWidth = Math.min(560, Math.max(260, event.clientX - left));
      setListPanelWidth(nextWidth);
    };
    const handleUp = () => setIsResizingListPanel(false);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isResizingListPanel]);

  const handleListPanelResizeStart = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setIsResizingListPanel(true);
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-background text-foreground animate-in fade-in duration-300 relative">
      
      {/* ADD PLAYER MODAL */}
      {isAddModalOpen && (
         <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-6" onClick={e => e.stopPropagation()}>
               <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tight">New Recruit</h3>
                  <p className="text-sm text-muted-foreground">Add a player and link their guardian account.</p>
               </div>
               
               <div className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-widest text-primary">Player Details</label>
                     <Input 
                        autoFocus
                        placeholder="Player Name (e.g. Timmy)" 
                        value={newPlayerName} 
                        onChange={e => setNewPlayerName(e.target.value)} 
                        className="bg-background border-border h-11"
                     />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                     <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Parent / Account Holder (Optional)</label>
                     <div className="grid grid-cols-2 gap-3">
                        <Input 
                           placeholder="Parent Name" 
                           value={newParentName} 
                           onChange={e => setNewParentName(e.target.value)} 
                           className="bg-background border-border"
                        />
                        <Input 
                           placeholder="Phone Number" 
                           value={newParentPhone} 
                           onChange={e => setNewParentPhone(e.target.value)} 
                           className="bg-background border-border"
                        />
                     </div>
                     <p className="text-[10px] text-muted-foreground italic">
                        *Entering a name here will automatically create a linked Client Account.
                     </p>
                  </div>
               </div>

               <div className="flex gap-3 pt-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button className="flex-1 font-bold" onClick={confirmCreatePlayer} disabled={!newPlayerName.trim()}>
                     Create Profile
                  </Button>
               </div>
            </div>
         </div>
      )}

      {/* List Panel */}
      <div
        ref={listPanelRef}
        style={{ '--locker-sidebar-width': `${listPanelWidth}px` } as React.CSSProperties}
        className={cn(
          "w-full border-r border-border bg-card/30 flex flex-col relative md:w-[var(--locker-sidebar-width)]",
          isResizingListPanel ? "transition-none" : "transition-all",
          selectedPlayerId ? "hidden md:flex" : "flex"
        )}
      >
        <div
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          onPointerDown={handleListPanelResizeStart}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none bg-transparent hover:bg-primary/30 hidden md:block"
        />
        <div className="p-4 border-b border-border/50 space-y-4">
           <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">The Squad</h2>
              <div className="flex gap-2">
                 <Button variant="ghost" size="sm" onClick={toggleSelectionMode} className={cn("h-8 text-xs", isSelectionMode && "text-primary bg-primary/10")}>
                    {isSelectionMode ? "Cancel" : "Select"}
                 </Button>
                 {!isSelectionMode && (
                    <Button size="sm" onClick={handleOpenAddModal} className="h-8 text-xs">
                       + Add
                    </Button>
                 )}
              </div>
           </div>
           <div className="relative">
              <Input 
                placeholder="Search players..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-card border-border focus-visible:ring-primary/20 h-9 text-sm"
              />
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
          {filteredPlayers.map(player => (
            <button
              key={player.id}
              onClick={() => isSelectionMode ? togglePlayerSelection(player.id) : setSelectedPlayerId(player.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left group relative",
                isSelectionMode && selectedPlayerIds.has(player.id)
                  ? "bg-primary/10 border-primary/50"
                  : selectedPlayerId === player.id 
                     ? "bg-secondary border-primary/50 ring-1 ring-primary/20 shadow-[0_0_15px_-3px_rgba(217,70,239,0.2)]" 
                     : "bg-card/40 border-transparent hover:bg-secondary"
              )}
            >
              {isSelectionMode && (
                 <div className={cn(
                    "h-5 w-5 rounded border flex items-center justify-center transition-all mr-1",
                    selectedPlayerIds.has(player.id) ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                 )}>
                    {selectedPlayerIds.has(player.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                 </div>
              )}
              <div 
                className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden border-2"
                style={{ 
                   borderColor: player.avatarColor,
                   backgroundColor: player.avatarUrl ? 'transparent' : `${player.avatarColor}33` 
                }}
              >
                {player.avatarUrl ? (
                  <img src={player.avatarUrl} className="h-full w-full object-cover" alt="" />
                ) : (
                  player.name.substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate text-foreground">{player.name}</div>
                <div className="text-[11px] text-muted-foreground">{player.level}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Bulk Action Footer */}
        {isSelectionMode && selectedPlayerIds.size > 0 && (
           <div className="p-4 border-t border-border bg-card/80 backdrop-blur animate-in slide-in-from-bottom-2">
              <div className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">{selectedPlayerIds.size} Selected</div>
              <Select onValueChange={handleBulkAssign}>
                 <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Assign Drill..." /></SelectTrigger>
                 <SelectContent>
                    {drills.map(d => <SelectItem key={d.id} value={d.id!}>{d.name}</SelectItem>)}
                 </SelectContent>
              </Select>
           </div>
        )}
      </div>

      {/* Detail Panel */}
      <div className={cn(
         "flex-1 flex flex-col h-full bg-background overflow-hidden",
         !selectedPlayerId ? "hidden md:flex items-center justify-center text-muted-foreground" : "flex"
      )}>
        {selectedPlayer ? (
           <PlayerDetailView 
              player={selectedPlayer}
              drills={drills}
              clients={clients}
              onUpdate={onUpdatePlayer}
              onUpsertClient={onUpsertClient}
              onDelete={onDeletePlayer}
              onBack={() => setSelectedPlayerId(null)}
              onAssignDrill={onAssignDrill}
              onUnassignDrill={onUnassignDrill}
           />
        ) : (
           <AcademyCourtView 
              players={players} 
              onSelectPlayer={(id) => setSelectedPlayerId(id)} 
              onUpdatePlayerPos={handleUpdatePlayerPos}
           />
        )}
      </div>
    </div>
  );
}

function PlayerDetailView({ player, drills, clients, onUpdate, onUpsertClient, onDelete, onBack, onAssignDrill, onUnassignDrill }: any) {
   const assignedDrillsData = drills.filter((d: Drill) => player.assignedDrills.includes(d.id));
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [showColors, setShowColors] = useState(false);
    const [activeTab, setActiveTab] = useState<'build' | 'history' | 'dna' | 'intel' | 'progress'>('build');

   // Client Linking State
   const [searchTerm, setSearchTerm] = useState("");
   const linkedClient = clients?.find((c: Client) => c.id === player.clientId);

   const handleStatChange = (stat: keyof PlayerStats, val: string) => {
      const num = Math.min(100, Math.max(0, parseInt(val) || 0));
      onUpdate({ ...player, stats: { ...player.stats, [stat]: num }, updatedAt: Date.now() });
   };

   const handleNestedUpdate = (category: string, key: string, val: any) => {
      onUpdate({
         ...player,
         [category]: { ...(player[category] || {}), [key]: val },
         updatedAt: Date.now()
      });
   };

   const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
         onUpdate({ ...player, avatarUrl: reader.result as string, updatedAt: Date.now() });
      };
      reader.readAsDataURL(file);
   };

   const handleCheckIn = () => {
      const now = Date.now();
      const attendance = player.attendance || [];
      onUpdate({ ...player, attendance: [...attendance, now], updatedAt: now });
   };

   const handleLinkClient = (client: Client) => {
      onUpdate({ ...player, clientId: client.id, updatedAt: Date.now() });
      setSearchTerm("");
   };

   const handleCreateClient = () => {
      if (!searchTerm || !onUpsertClient) return;
      const newClient: Client = {
         id: nanoid(),
         name: searchTerm,
         email: "",
         phone: "",
         status: "Active",
         createdAt: Date.now(),
         updatedAt: Date.now()
      };
      onUpsertClient(newClient);
      onUpdate({ ...player, clientId: newClient.id, updatedAt: Date.now() });
      setSearchTerm("");
   };

   return (
      <div className="flex-1 flex flex-col min-h-0 bg-background">
         {/* Mobile Header */}
         <div className="md:hidden flex items-center p-4 border-b border-border bg-card/50">
            <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mr-2">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </Button>
            <span className="font-semibold text-sm uppercase tracking-widest">Profile</span>
         </div>

         {/* Hero Header */}
         <div className="p-6 md:p-10 pb-4 border-b border-border bg-card/10 shrink-0">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start max-w-5xl mx-auto w-full">
               <div className="relative group shrink-0">
                  <div 
                    className="h-28 w-28 md:h-36 md:w-32 rounded-3xl flex items-center justify-center text-3xl md:text-4xl font-bold text-white shadow-2xl border-[4px] overflow-hidden transition-all"
                    style={{ 
                       borderColor: player.avatarColor,
                       backgroundColor: player.avatarUrl ? 'transparent' : `${player.avatarColor}33`,
                       boxShadow: `0 0 20px -5px ${player.avatarColor}66`
                    }}
                  >
                    {player.avatarUrl ? (
                      <img src={player.avatarUrl} className="h-full w-full object-cover" alt="" />
                    ) : (
                      player.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  
                  <button onClick={() => setShowColors(!showColors)} className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full border-2 border-border bg-secondary flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10">
                     <div className="h-4 w-4 rounded-full" style={{ backgroundColor: player.avatarColor }} />
                  </button>

                  {showColors && (
                     <div className="absolute top-full left-0 mt-2 z-50 bg-card border border-border p-2 rounded-2xl shadow-2xl flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                        {AVATAR_COLORS.map(color => (
                           <button key={color} onClick={() => { onUpdate({...player, avatarColor: color, updatedAt: Date.now()}); setShowColors(false); }} className={cn("h-6 w-6 rounded-full border-2 transition-all hover:scale-110", player.avatarColor === color ? "border-white" : "border-transparent")} style={{ backgroundColor: color }} />
                        ))}
                     </div>
                  )}
               </div>
               
               <div className="flex-1 space-y-4 w-full">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                     <div className="space-y-1">
                        <Input value={player.name} onChange={e => onUpdate({...player, name: e.target.value})} className="text-2xl md:text-4xl font-black bg-transparent border-transparent hover:border-border focus:bg-card/50 px-2 -ml-2 h-auto py-1 text-center md:text-left tracking-tighter uppercase" />
                        <div className="flex items-center justify-center md:justify-start gap-3">
                           <span className="text-[10px] font-black tracking-[0.2em] text-primary uppercase">{player.level}</span>
                           <div className="h-1 w-1 rounded-full bg-muted" />
                           <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{player.handedness || 'Handedness'}</span>
                        </div>
                     </div>
                     <div className="flex gap-2 justify-center">
                        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-3 gap-2 text-muted-foreground hover:text-foreground bg-card/50 border border-border font-bold text-[10px] tracking-widest">
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                           SQUAD
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onDelete(player.id)} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 h-8 px-3 border border-transparent font-bold text-[10px] tracking-widest">
                           DELETE
                        </Button>
                     </div>
                  </div>

                   <div className="flex items-center justify-center md:justify-start gap-1 p-1 bg-card/50 border border-border rounded-xl w-fit">
                      {[
                         { id: 'build', label: 'The Build' },
                         { id: 'history', label: 'Progression' },
                         { id: 'dna', label: 'DNA' },
                         { id: 'intel', label: 'Intel' },
                         { id: 'progress', label: 'Progress' }
                      ].map(tab => (
                         <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all", activeTab === tab.id ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{tab.label}</button>
                      ))}
                   </div>
               </div>
            </div>
         </div>

         {/* Content Area */}
         <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
            <div className="max-w-5xl mx-auto p-6 md:p-10">
               
               {activeTab === 'build' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                     <div className="lg:col-span-7 space-y-8">
                        <Section title="Foundation Specs">
                           <div className="grid grid-cols-2 gap-4">
                              <Field label="Dominant Hand">
                                 <Select value={player.handedness} onValueChange={v => onUpdate({...player, handedness: v})}>
                                    <SelectTrigger className="h-10 bg-card/50 border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent><SelectItem value="Right">Right Hand</SelectItem><SelectItem value="Left">Left Hand</SelectItem></SelectContent>
                                 </Select>
                              </Field>
                              <Field label="Archetype">
                                 <Select value={player.playStyle} onValueChange={v => onUpdate({...player, playStyle: v})}>
                                    <SelectTrigger className="h-10 bg-card/50 border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                       <SelectItem value="Aggressive Baseliner">Aggressive Baseliner</SelectItem>
                                       <SelectItem value="Serve & Volleyer">Serve & Volleyer</SelectItem>
                                       <SelectItem value="Counter-Puncher">Counter-Puncher</SelectItem>
                                       <SelectItem value="All-Court">All-Court</SelectItem>
                                    </SelectContent>
                                 </Select>
                              </Field>
                              <Field label="Height (cm)">
                                 <Input value={player.height || ''} onChange={e => onUpdate({...player, height: e.target.value})} placeholder="e.g. 178 cm" className="h-10 bg-card/50 border-border" />
                              </Field>
                              <Field label="Reach (cm)">
                                 <Input value={player.reach || ''} onChange={e => onUpdate({...player, reach: e.target.value})} placeholder="e.g. 182 cm" className="h-10 bg-card/50 border-border" />
                              </Field>
                              <Field label="Academy Level">
                                 <Select value={player.level} onValueChange={v => onUpdate({...player, level: v})}>
                                    <SelectTrigger className="h-10 bg-card/50 border-border"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="Beginner">Beginner</SelectItem><SelectItem value="Intermediate">Intermediate</SelectItem><SelectItem value="Advanced">Advanced</SelectItem></SelectContent>
                                 </Select>
                              </Field>
                              <Field label="Date of Birth">
                                 <Input type="date" value={player.dob || ''} onChange={e => onUpdate({...player, dob: e.target.value})} className="h-10 bg-card/50 border-border color-scheme-dark" />
                              </Field>
                           </div>
                        </Section>

                        <Section title="My Kit">
                           <div className="grid grid-cols-2 gap-4">
                              <Field label="Racket Model">
                                 <Input placeholder="Model" value={player.equipment?.racket || ''} onChange={e => updateEquipment('racket', e.target.value)} className="h-10 bg-card/50 border-border" />
                              </Field>
                              <Field label="Grip Size">
                                 <Select value={player.equipment?.gripSize || ''} onValueChange={v => updateEquipment('gripSize', v)}>
                                    <SelectTrigger className="h-10 bg-card/50 border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                       <SelectItem value="4 1/8 (L1)">4 1/8 (L1)</SelectItem>
                                       <SelectItem value="4 1/4 (L2)">4 1/4 (L2)</SelectItem>
                                       <SelectItem value="4 3/8 (L3)">4 3/8 (L3)</SelectItem>
                                       <SelectItem value="4 1/2 (L4)">4 1/2 (L4)</SelectItem>
                                    </SelectContent>
                                 </Select>
                              </Field>
                              <Field label="Tension (kg)">
                                 <Input placeholder="kg" value={player.equipment?.tension || ''} onChange={e => updateEquipment('tension', e.target.value)} className="h-10 bg-card/50 border-border" />
                              </Field>
                              <Field label="Last Restrung">
                                 <Input type="date" value={player.equipment?.lastRestrung || ''} onChange={e => updateEquipment('lastRestrung', e.target.value)} className="h-10 bg-card/50 border-border color-scheme-dark" />
                              </Field>
                           </div>
                        </Section>
                        <Section title="Journal Entries">
                           <textarea className="w-full h-48 bg-card/30 border border-border rounded-2xl p-5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none leading-relaxed text-foreground no-scrollbar" placeholder="General observations..." value={player.notes || ''} onChange={e => onUpdate({...player, notes: e.target.value})} />
                        </Section>
                     </div>
                     <div className="lg:col-span-5 space-y-8">
                        <div className="p-6 rounded-3xl border border-border bg-card/20 flex flex-col items-center">
                           <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">Physical Profile</h3>
                           <RadarChart stats={player.stats} size={240} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           {Object.entries(player.stats).map(([key, val]) => (
                              <div key={key} className="p-3 rounded-xl border border-border bg-card/20 space-y-1">
                                 <div className="flex justify-between items-center"><label className="text-[9px] uppercase font-bold text-muted-foreground">{key}</label><span className="text-[10px] font-mono font-bold text-primary">{val}%</span></div>
                                 <input type="range" min="0" max="100" value={val as number} onChange={e => handleStatChange(key as keyof PlayerStats, e.target.value)} className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer" />
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'history' && (
                  <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                     <Section title="Personal Bests & Metrics">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <PBMetric label="Back to Base" unit="sec" value={player.pbs?.backToBase} onChange={v => handleNestedUpdate('pbs', 'backToBase', v)} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>} />
                           <PBMetric label="Longest Rally" unit="shots" value={player.pbs?.longestRally} onChange={v => handleNestedUpdate('pbs', 'longestRally', parseInt(v))} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>} />
                           <PBMetric label="1st Serve" unit="%" value={player.pbs?.firstServePct} onChange={v => handleNestedUpdate('pbs', 'firstServePct', parseInt(v))} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>} />
                           <PBMetric label="Attendance Streak" unit="sessions" value={player.pbs?.attendanceStreak} onChange={v => handleNestedUpdate('pbs', 'attendanceStreak', parseInt(v))} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11"></polyline></svg>} />
                        </div>
                     </Section>
                     <Section title="Attendance Heatmap">
                        <div className="p-6 rounded-3xl border border-border bg-card/20 space-y-6">
                           <div className="flex items-center justify-between">
                              <div className="flex flex-wrap gap-1.5">{Array.from({ length: 28 }).map((_, i) => {
                                 const date = new Date(); date.setDate(date.getDate() - (27 - i));
                                 const isAttended = player.attendance?.some((ts: number) => new Date(ts).toDateString() === date.toDateString());
                                 return <div key={i} className={cn("h-5 w-5 rounded-md", isAttended ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : "bg-secondary")} title={date.toDateString()} />;
                              })}</div>
                              <Button size="sm" onClick={handleCheckIn} className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] tracking-widest h-10 px-6 rounded-xl">CHECK-IN</Button>
                           </div>
                        </div>
                     </Section>
                     <Section title="Technical Growth">
                        <textarea className="w-full h-32 bg-card/30 border border-border rounded-2xl p-5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none leading-relaxed text-foreground no-scrollbar" placeholder="Technical progression notes..." value={player.analysisNotes || ''} onChange={e => onUpdate({...player, analysisNotes: e.target.value})} />
                     </Section>
                  </div>
               )}

               {activeTab === 'dna' && (
                  <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                     <Section title="Player DNA & Preferences">
                        <div className="grid grid-cols-1 gap-6">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <Field label="Favorite Shot">
                                 <Input value={player.dna?.favoriteShot || ''} onChange={e => handleNestedUpdate('dna', 'favoriteShot', e.target.value)} placeholder="e.g. Cross-court FH Winner" className="h-12 bg-card/50 border-border rounded-xl" />
                              </Field>
                              <Field label="Career Goal">
                                 <Input value={player.dna?.careerGoal || ''} onChange={e => handleNestedUpdate('dna', 'careerGoal', e.target.value)} placeholder="e.g. High School Team" className="h-12 bg-card/50 border-border rounded-xl" />
                              </Field>
                              <Field label="Spirit Pro (Favorite Player)">
                                 <Input value={player.dna?.favoritePro || ''} onChange={e => handleNestedUpdate('dna', 'favoritePro', e.target.value)} placeholder="e.g. Roger Federer" className="h-12 bg-card/50 border-border rounded-xl" />
                              </Field>
                              <Field label={`Confidence Level (${player.dna?.confidence || 5}/10)`}>
                                 <input type="range" min="1" max="10" value={player.dna?.confidence || 5} onChange={e => handleNestedUpdate('dna', 'confidence', parseInt(e.target.value))} className="w-full accent-orange-500 h-1 bg-secondary rounded-lg appearance-none cursor-pointer mt-4" />
                              </Field>
                           </div>
                        </div>
                     </Section>
                     <Section title="Prescribed Drills">
                        <div className="flex items-center gap-2 mb-4">
                           <Select onValueChange={(drillId) => onAssignDrill(player.id, drillId)}>
                              <SelectTrigger className="h-10 w-full bg-card border-border rounded-xl"><SelectValue placeholder="Add new drill to development plan..." /></SelectTrigger>
                              <SelectContent className="max-h-[300px]">{drills.map((d: Drill) => <SelectItem key={d.id} value={d.id!}>{d.name}</SelectItem>)}</SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-3">
                           {assignedDrillsData.map((d: Drill) => (
                              <div key={d.id} className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card/40 group hover:border-primary/20 transition-all">
                                 <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-xs font-black text-muted-foreground">{d.name.substring(0,1)}</div>
                                    <div><div className="text-sm font-bold text-foreground">{d.name}</div><div className="text-[10px] text-muted-foreground uppercase tracking-widest">{d.intensity} • {d.format}</div></div>
                                 </div>
                                 <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-400" onClick={() => onUnassignDrill(player.id, d.id!)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></Button>
                              </div>
                           ))}
                        </div>
                     </Section>
                  </div>
               )}

               {activeTab === 'intel' && (
                  <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                     <Section title="Parent Account & Linking">
                        {linkedClient ? (
                           <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                              <div>
                                 <p className="text-xs font-bold uppercase tracking-widest text-primary">Linked Account</p>
                                 <p className="font-bold text-lg">{linkedClient.name}</p>
                                 <p className="text-xs text-muted-foreground">{linkedClient.phone}</p>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => onUpdate({ ...player, clientId: undefined, updatedAt: Date.now() })}>
                                 Unlink
                              </Button>
                           </div>
                        ) : (
                           <div className="space-y-4 bg-card/30 p-4 rounded-xl border border-border">
                              <Field label="Link Parent Account (Search or Create)">
                                 <div className="flex gap-2">
                                    <Input 
                                       placeholder="Search Parent Name..." 
                                       value={searchTerm}
                                       onChange={e => setSearchTerm(e.target.value)}
                                       className="h-10 bg-card border-border"
                                    />
                                    {searchTerm && (
                                       <Button className="shrink-0" onClick={handleCreateClient}>
                                          + Create New "{searchTerm}"
                                       </Button>
                                    )}
                                 </div>
                              </Field>
                              {/* Search Results */}
                              {searchTerm && clients && (
                                 <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {clients
                                       .filter((c: Client) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                       .map((c: Client) => (
                                          <button key={c.id} onClick={() => handleLinkClient(c)} className="w-full text-left p-2 rounded hover:bg-secondary text-sm">
                                             <div className="font-bold">{c.name}</div>
                                             <div className="text-xs text-muted-foreground">{c.phone}</div>
                                          </button>
                                       ))}
                                 </div>
                              )}
                           </div>
                        )}
                     </Section>

                     <Section title="Logistics & Administration">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <Field label="Training Day">
                              <Input value={player.intel?.sessionDay || ''} onChange={e => handleNestedUpdate('intel', 'sessionDay', e.target.value)} placeholder="e.g. Mondays" className="h-12 bg-card/50 border-border rounded-xl" />
                           </Field>
                           <Field label="Court Location">
                              <Input value={player.intel?.location || ''} onChange={e => handleNestedUpdate('intel', 'location', e.target.value)} placeholder="e.g. Court 4" className="h-12 bg-card/50 border-border rounded-xl" />
                           </Field>
                        </div>
                     </Section>
                     <Section title="Safety & Administration">
                        <div className="space-y-6">
                           <Field label="Medical Alerts (Allergies / Asthma / Injuries)">
                              <Input value={player.intel?.medicalAlerts || ''} onChange={e => handleNestedUpdate('intel', 'medicalAlerts', e.target.value)} placeholder="List any critical medical info..." className="h-12 bg-rose-500/5 border-rose-500/20 rounded-xl text-rose-200" />
                           </Field>
                        </div>
                      </Section>
                   </div>
                )}

                {activeTab === 'progress' && (
                   <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <Section title="Quick Stats">
                         <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                               { key: 'tech', label: 'Technique', color: '#ef4444' },
                               { key: 'consistency', label: 'Consistency', color: '#f59e0b' },
                               { key: 'tactics', label: 'Tactics', color: '#10b981' },
                               { key: 'movement', label: 'Movement', color: '#3b82f6' },
                               { key: 'coachability', label: 'Coachability', color: '#8b5cf6' },
                            ].map(({ key, label, color }) => {
                               const stat = player.stats?.[key] || 0;
                               return (
                                  <div key={key} className="p-4 rounded-xl bg-card/50 border border-border text-center">
                                     <div className="text-2xl font-black" style={{ color }}>{stat}</div>
                                     <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
                                  </div>
                               );
                            })}
                         </div>
                      </Section>
                      <Section title="Goals">
                         <div className="p-4 rounded-xl bg-card/30 border border-border">
                            <p className="text-sm text-muted-foreground text-center py-4">
                               View detailed progress tracking, goals, and trends in the dedicated Progress view.
                            </p>
                            <Button className="w-full" onClick={() => alert('Navigate to Progress view')}>
                               Open Full Progress Dashboard
                            </Button>
                         </div>
                      </Section>
                   </div>
                )}

             </div>
          </div>
       </div>
    );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
   return (
      <div className="space-y-4">
         <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">{title}</h3>
         {children}
      </div>
   );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
   return (
      <div className="space-y-2">
         <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">{label}</label>
         {children}
      </div>
   );
}

function PBMetric({ label, unit, value, onChange, icon }: any) {
   return (
      <div className="p-5 rounded-3xl border border-border bg-card/40 flex items-center justify-between group hover:border-primary/20 transition-all">
         <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-primary shadow-inner">{icon}</div>
            <div>
               <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</div>
               <div className="flex items-baseline gap-1">
                  <Input 
                     variant="ghost" 
                     className="h-auto p-0 text-xl font-black w-16 bg-transparent border-none focus-visible:ring-0" 
                     value={value || ''} 
                     onChange={e => onChange(e.target.value)}
                     placeholder="0"
                  />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{unit}</span>
               </div>
            </div>
         </div>
      </div>
   );
}

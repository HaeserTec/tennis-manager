import React, { useState, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, nanoid } from '@/lib/utils';
import type { Player, PlayerStats, Drill, Client, TrainingSession, DayEvent, SessionObservation } from '@/lib/playbook';
import { RadarChart } from '@/components/RadarChart';
import { AcademyCourtView } from '@/components/AcademyCourtView';
import { PlayerDossier } from '@/components/locker/PlayerDossier';

interface LockerRoomProps {
  players: Player[];
  drills: Drill[];
  clients?: Client[];
  sessions?: TrainingSession[];
  dayEvents?: DayEvent[];
  sessionObservations?: SessionObservation[];
  onUpdatePlayer: (player: Player) => void;
  onAddPlayer: (player: Player) => void;
  onUpsertClient?: (client: Client) => void;
  onDeletePlayer: (playerId: string) => void;
  onDeleteClient?: (clientId: string) => void;
  onMergeClients?: (sourceId: string, targetId: string) => void;
  onAssignDrill: (playerId: string, drillId: string) => void;
  onUnassignDrill: (playerId: string, drillId: string) => void;
  onUploadFile?: (bucket: string, file: File) => Promise<string | null>;
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

export function LockerRoom({ players, drills, clients = [], sessions = [], dayEvents = [], sessionObservations = [], onUpdatePlayer, onAddPlayer, onUpsertClient, onDeletePlayer, onDeleteClient, onMergeClients, onAssignDrill, onUnassignDrill, initialSelectedPlayerId }: LockerRoomProps) {
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
      schedule: [],
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
    <div className="app-page flex flex-col md:flex-row h-full overflow-hidden text-foreground relative">
      
      {/* ADD PLAYER MODAL */}
      {isAddModalOpen && (
         <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="app-card w-full max-w-md rounded-2xl p-6 space-y-6" onClick={e => e.stopPropagation()}>
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
          "app-panel-muted app-divider w-full border-r flex flex-col relative md:w-[var(--locker-sidebar-width)]",
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
                "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group relative",
                isSelectionMode && selectedPlayerIds.has(player.id)
                  ? "bg-primary/10 border-primary/50"
                  : selectedPlayerId === player.id 
                     ? "bg-secondary border-primary/50 ring-1 ring-primary/20 shadow-lg glow-primary" 
                     : "app-card border-transparent hover:bg-secondary/50 app-card-hover"
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
                className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0 overflow-hidden border-2 shadow-lg"
                style={{ 
                   borderColor: player.avatarColor,
                   backgroundColor: player.avatarUrl ? 'transparent' : `${player.avatarColor}33`,
                   boxShadow: `0 0 10px -2px ${player.avatarColor}aa`
                }}
              >
                {player.avatarUrl ? (
                  <img src={player.avatarUrl} className="h-full w-full object-cover" alt="" />
                ) : (
                  player.name.substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-sm truncate text-foreground uppercase tracking-tight">{player.name}</div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">{player.level}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Bulk Action Footer */}
        {isSelectionMode && selectedPlayerIds.size > 0 && (
           <div className="p-4 border-t border-border bg-card/80 backdrop-blur">
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
           <PlayerDossier
              player={selectedPlayer}
              players={players}
              drills={drills}
              clients={clients}
              sessions={sessions}
              dayEvents={dayEvents}
              sessionObservations={sessionObservations}
              onUpdate={onUpdatePlayer}
              onUpsertClient={onUpsertClient}
              onDelete={onDeletePlayer}
              onDeleteClient={onDeleteClient}
              onMergeClients={onMergeClients}
              onBack={() => setSelectedPlayerId(null)}
              onAssignDrill={onAssignDrill}
              onUnassignDrill={onUnassignDrill}
           />
        ) : (
           <AcademyCourtView 
              players={players} 
              sessions={sessions}
              onSelectPlayer={(id) => setSelectedPlayerId(id)} 
              onUpdatePlayerPos={handleUpdatePlayerPos}
           />
        )}
      </div>
    </div>
  );
}

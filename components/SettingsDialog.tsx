import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, nanoid } from '@/lib/utils';
import { X, MapPin, Plus, Trash2, Settings, Globe, RefreshCw, Cloud } from 'lucide-react';
import type { Session } from '@/lib/playbook';

export interface LocationConfig {
  id: string;
  name: string;
  defaultRate: number;
  sessionType: Session;
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  locations: LocationConfig[];
  onUpdateLocations: (locs: LocationConfig[]) => void;
  theme: 'dark' | 'light' | 'midnight';
  onSetTheme: (t: 'dark' | 'light' | 'midnight') => void;
  onForceSync?: () => Promise<void>;
}

export function SettingsDialog({ isOpen, onClose, locations, onUpdateLocations, theme, onSetTheme, onForceSync }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'academy'>('academy');
  const [newLocName, setNewLocName] = useState('');
  const [newLocRate, setNewLocRate] = useState('');
  const [newLocType, setNewLocType] = useState<Session>('Group');
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleAddLocation = () => {
    if (!newLocName || !newLocRate) return;
    const newLoc: LocationConfig = {
      id: nanoid(),
      name: newLocName,
      defaultRate: Number(newLocRate),
      sessionType: newLocType
    };
    onUpdateLocations([...locations, newLoc]);
    setNewLocName('');
    setNewLocRate('');
    setNewLocType('Group');
  };

  const handleRemoveLocation = (id: string) => {
    onUpdateLocations(locations.filter(l => l.id !== id));
  };

  const handleSync = async () => {
    if (!onForceSync) return;
    setIsSyncing(true);
    await onForceSync();
    setTimeout(() => setIsSyncing(false), 500); // Visual feedback
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-background border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-card/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tighter">Settings</h2>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Configuration</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-48 border-r border-border bg-secondary/20 p-4 space-y-2">
            <button
              onClick={() => setActiveTab('academy')}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl text-left text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === 'academy' 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Globe className="w-4 h-4" />
              Locations
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl text-left text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === 'general' 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Settings className="w-4 h-4" />
              General
            </button>
          </div>

          {/* Main Panel */}
          <div className="flex-1 p-8 overflow-y-auto bg-background/50">
            {activeTab === 'academy' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-bold mb-1">Locations & Rates</h3>
                  <p className="text-sm text-muted-foreground">Manage your training locations and standard hourly rates.</p>
                </div>

                {/* Add New */}
                <div className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-4">
                  <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">Add New Location</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-3">
                        <Input 
                        placeholder="Location Name (e.g. Town A)" 
                        value={newLocName}
                        onChange={e => setNewLocName(e.target.value)}
                        className="bg-background"
                        />
                    </div>
                    
                    <Select value={newLocType} onValueChange={(v: Session) => setNewLocType(v)}>
                        <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Group">Group</SelectItem>
                            <SelectItem value="Private">Private</SelectItem>
                            <SelectItem value="Semi">Semi</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">R</span>
                      <Input 
                        type="number" 
                        placeholder="Rate" 
                        value={newLocRate}
                        onChange={e => setNewLocRate(e.target.value)}
                        className="pl-7 bg-background"
                      />
                    </div>
                    
                    <Button onClick={handleAddLocation} disabled={!newLocName || !newLocRate}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* List */}
                <div className="space-y-2">
                  <div className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Active Locations</div>
                  {locations.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic px-1">No locations configured.</div>
                  ) : (
                    locations.map(loc => (
                      <div key={loc.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/40 hover:bg-card/60 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-sm">{loc.name}</div>
                            <div className="text-xs text-muted-foreground flex gap-2">
                                <span className="uppercase tracking-wider font-bold">{loc.sessionType}</span>
                                <span className="opacity-50">•</span>
                                <span className="font-mono">R{loc.defaultRate}/hr</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => handleRemoveLocation(loc.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-bold mb-1">Application Preferences</h3>
                  <p className="text-sm text-muted-foreground">Customize your experience.</p>
                </div>
                
                <div className="flex flex-col gap-4 p-4 rounded-xl border border-border bg-card/40">
                  <div>
                    <div className="font-bold text-sm">Theme Mode</div>
                    <div className="text-xs text-muted-foreground">Select your preferred appearance</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => onSetTheme('light')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                        theme === 'light' 
                          ? "bg-primary/20 border-primary text-primary" 
                          : "bg-background border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <div className="w-4 h-4 rounded-full bg-stone-200 border border-stone-400" />
                      <span className="text-xs font-bold">Light</span>
                    </button>
                    <button
                      onClick={() => onSetTheme('dark')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                        theme === 'dark' 
                          ? "bg-primary/20 border-primary text-primary" 
                          : "bg-background border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <div className="w-4 h-4 rounded-full bg-zinc-900 border border-zinc-700" />
                      <span className="text-xs font-bold">Dark</span>
                    </button>
                    <button
                      onClick={() => onSetTheme('midnight')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                        theme === 'midnight' 
                          ? "bg-primary/20 border-primary text-primary" 
                          : "bg-background border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <div className="w-4 h-4 rounded-full bg-[#0f172a] border border-slate-700" />
                      <span className="text-xs font-bold">Midnight</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 p-4 rounded-xl border border-border bg-card/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                         <Cloud className="w-4 h-4" /> Cloud Sync
                      </div>
                      <div className="text-xs text-muted-foreground">Manually trigger a data synchronization.</div>
                    </div>
                    <Button 
                       size="sm" 
                       variant="outline" 
                       onClick={handleSync} 
                       disabled={isSyncing}
                       className="gap-2"
                    >
                       <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                       {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

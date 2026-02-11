import React, { useState, useMemo, useCallback, useDeferredValue, useRef } from 'react';
import { cn, nanoid, nowMs } from '@/lib/utils';
import type { Drill, DrillTemplate, Format, Intensity, SessionType } from '@/lib/playbook';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, Grid, List, FolderOpen, Tag, Download, Upload, 
  Plus, Star, StarOff, Trash2, Edit2, Copy, Dumbbell, LayoutTemplate,
  ChevronDown, X, Filter
} from 'lucide-react';
import { useDrillCategories, useDrillTags, useDataExport } from '@/lib/hooks';
import { DrillThumbnail } from './DrillThumbnail';
import { PlaybookDiagramV2 } from './PlaybookDiagramV2';

interface DrillStudioProps {
  drills: Drill[];
  templates: DrillTemplate[];
  onAddDrill: (drill: Drill) => void;
  onUpdateDrill: (drill: Drill) => void;
  onDeleteDrill: (id: string) => void;
  onAddTemplate: (template: DrillTemplate) => void;
  onUpdateTemplate: (template: DrillTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onNavigateHome: () => void;
  initialMode?: 'drills' | 'templates';
}

type StudioMode = 'drills' | 'templates';
type ViewMode = 'grid' | 'list';
type SortOption = 'name' | 'updated' | 'created' | 'level';

const getBadgeStyles = (type: 'intensity' | 'level' | 'session' | 'time', value: string) => {
  const base = "px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap";
  
  if (type === 'intensity') {
    switch (value) {
      case 'Warm-Up': return cn(base, "bg-violet-500/10 text-violet-400 border-violet-500/20");
      case 'Active': return cn(base, "bg-amber-500/10 text-amber-400 border-amber-500/20");
      case 'Hard Work': return cn(base, "bg-rose-500/10 text-rose-400 border-rose-500/20");
      default: return cn(base, "bg-secondary text-muted-foreground border-transparent");
    }
  }

  if (type === 'level') {
    switch (value) {
      case 'Beginner': return cn(base, "bg-secondary text-muted-foreground border-transparent");
      case 'Intermediate': return cn(base, "bg-emerald-500/10 text-emerald-400 border-emerald-500/20");
      case 'Advanced': return cn(base, "bg-blue-500/10 text-blue-400 border-blue-500/20");
      default: return cn(base, "bg-secondary text-muted-foreground border-transparent");
    }
  }

  return cn(base, "bg-secondary text-foreground border-border");
};

export function DrillStudio({ 
  drills, templates, 
  onAddDrill, onUpdateDrill, onDeleteDrill,
  onAddTemplate, onUpdateTemplate, onDeleteTemplate,
  onNavigateHome,
  initialMode = 'drills'
}: DrillStudioProps) {
  // Studio Mode
  const [studioMode, setStudioMode] = useState<StudioMode>(initialMode);
  
  // Selection State
  const [activeDrillId, setActiveDrillId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>("All");
  const [filterIntensity, setFilterIntensity] = useState<string>("All");
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  
  // Modal States
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Drill | null>(null);
  const [editTemplateForm, setEditTemplateForm] = useState<DrillTemplate | null>(null);
  
  // Hover Preview
  const [hoveredItem, setHoveredItem] = useState<Drill | DrillTemplate | null>(null);
  
  // Canvas State Ref
  const latestCanvasState = useRef<any>(null);
  
  // Hooks
  const { categories, addCategory, updateCategory, deleteCategory, resetToDefaults } = useDrillCategories();
  const { tags, addTag, renameTag, deleteTag } = useDrillTags(drills);
  const { exportData } = useDataExport();
  
  const currentItems = studioMode === 'drills' ? drills : templates;
  const activeId = studioMode === 'drills' ? activeDrillId : activeTemplateId;
  
  // Filtered Items
  const filteredItems = useMemo(() => {
    let result = [...currentItems];
    const q = deferredSearchQuery.toLowerCase();
    
    // Search filter
    if (q) {
      result = result.filter((item: any) => 
        item.name.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q)) ||
        (item.tags || []).some((t: string) => t.toLowerCase().includes(q))
      );
    }
    
    // Category filter (drills only)
    if (studioMode === 'drills' && selectedCategory !== 'all') {
      result = result.filter((d: any) => d.categoryId === selectedCategory);
    }
    
    // Level filter (drills only)
    if (studioMode === 'drills' && filterLevel !== "All") {
      result = result.filter((d: any) => d.format === filterLevel);
    }
    
    // Intensity filter (drills only)
    if (studioMode === 'drills' && filterIntensity !== "All") {
      result = result.filter((d: any) => d.intensity === filterIntensity);
    }
    
    // Tag filter
    if (selectedTags.length > 0) {
      result = result.filter((d: any) => d.tags?.some((t: string) => selectedTags.includes(t)));
    }
    
    // Starred only
    if (showStarredOnly) {
      result = result.filter((d: any) => d.starred);
    }
    
    // Sort
    result.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'updated': return (b.updatedAt || 0) - (a.updatedAt || 0);
        case 'created': return (b.createdAt || 0) - (a.createdAt || 0);
        case 'level': return (a.format || '').localeCompare(b.format || '');
        default: return 0;
      }
    });
    
    return result;
  }, [currentItems, deferredSearchQuery, selectedCategory, filterLevel, filterIntensity, selectedTags, showStarredOnly, sortBy, studioMode]);
  
  // Grouped Drills (for list view in drills mode)
  const groupedDrills = useMemo(() => {
    if (studioMode !== 'drills') return null;
    const sessions: Record<string, Drill[]> = { Private: [], Semi: [], Group: [], Other: [] };
    for (const d of filteredItems as Drill[]) {
      if (d.session === 'Private') sessions.Private.push(d);
      else if (d.session === 'Semi') sessions.Semi.push(d);
      else if (d.session === 'Group') sessions.Group.push(d);
      else sessions.Other.push(d);
    }
    return sessions;
  }, [filteredItems, studioMode]);
  
  const handleCreateNew = () => {
    if (studioMode === 'drills') {
      const newDrill: Drill = { 
        id: nanoid(), 
        name: 'Untitled Drill', 
        session: 'Private', 
        format: 'Intermediate', 
        intensity: 'Active', 
        durationMins: 10, 
        diagram: { nodes: [], paths: [] } 
      };
      onAddDrill(newDrill);
      setActiveDrillId(newDrill.id!);
      setEditForm(newDrill);
      setIsEditing(true);
    } else {
      const newTemplate: DrillTemplate = { 
        id: nanoid(), 
        name: 'New Template', 
        diagram: { nodes: [], paths: [] } 
      };
      onAddTemplate(newTemplate);
      setActiveTemplateId(newTemplate.id);
    }
  };
  
  const handleSelectItem = (item: Drill | DrillTemplate) => {
    if (studioMode === 'drills') {
      setActiveDrillId(item.id!);
      setActiveTemplateId(null);
      setEditForm(item as Drill);
      setIsEditing(false);
      window.dispatchEvent(new CustomEvent("playbook:diagram:apply-drill", { detail: { drill: item } }));
    } else {
      setActiveTemplateId(item.id);
      setActiveDrillId(null);
      window.dispatchEvent(new CustomEvent("playbook:diagram:apply-template", { detail: { template: item } }));
    }
  };
  
  const handleEditClick = (item: Drill | DrillTemplate) => {
    if (studioMode === 'drills') {
      setEditForm({ ...(item as Drill) });
      setIsEditing(true);
    } else {
      setEditTemplateForm({ ...(item as DrillTemplate) });
      setIsEditing(true);
    }
  };
  
  const handleSave = () => {
    if (studioMode === 'drills' && editForm) {
      onUpdateDrill({ ...editForm, updatedAt: nowMs() });
      setIsEditing(false);
      setEditForm(null);
    } else if (editTemplateForm) {
      onUpdateTemplate({ ...editTemplateForm, updatedAt: nowMs() });
      setIsEditing(false);
      setEditTemplateForm(null);
    }
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    setEditForm(null);
    setEditTemplateForm(null);
  };
  
  const handleDuplicate = (item: Drill | DrillTemplate) => {
    if (studioMode === 'drills') {
      const newDrill: Drill = {
        ...(item as Drill),
        id: nanoid(),
        name: `${item.name} (Copy)`,
        updatedAt: nowMs(),
        createdAt: nowMs(),
      };
      onAddDrill(newDrill);
    } else {
      const newTemplate: DrillTemplate = {
        ...(item as DrillTemplate),
        id: nanoid(),
        name: `${item.name} (Copy)`,
        updatedAt: nowMs(),
        createdAt: nowMs(),
      };
      onAddTemplate(newTemplate);
    }
  };
  
  const toggleStar = (id: string) => {
    if (studioMode === 'drills') {
      const drill = drills.find(d => d.id === id);
      if (drill) onUpdateDrill({ ...drill, starred: !drill.starred, updatedAt: nowMs() });
    } else {
      const tpl = templates.find(t => t.id === id);
      if (tpl) onUpdateTemplate({ ...tpl, starred: !tpl.starred, updatedAt: nowMs() });
    }
  };
  
  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    if (studioMode === 'drills') {
      onDeleteDrill(id);
      if (activeDrillId === id) setActiveDrillId(null);
    } else {
      onDeleteTemplate(id);
      if (activeTemplateId === id) setActiveTemplateId(null);
    }
  };
  
  const handleSaveTemplateFromCanvas = (name: string) => {
    const state = latestCanvasState.current;
    if (!state) return;
    const newTpl: DrillTemplate = {
      id: nanoid(),
      name: name || 'New Template',
      diagram: state,
      createdAt: nowMs(),
      updatedAt: nowMs()
    };
    onAddTemplate(newTpl);
    alert("Template saved!");
  };
  
  const handleExport = () => {
    exportData({
      drills,
      templates,
      categories,
      tags,
    }, 'tennis-lab-library.json');
  };
  
  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };
  
  // Get active item for canvas
  const activeItem = useMemo(() => {
    if (studioMode === 'drills' && activeDrillId) {
      return drills.find(d => d.id === activeDrillId);
    } else if (activeTemplateId) {
      return templates.find(t => t.id === activeTemplateId);
    }
    return null;
  }, [studioMode, activeDrillId, activeTemplateId, drills, templates]);

  return (
    <div className="app-page flex h-full overflow-hidden">
      {/* Left Sidebar - Library Panel */}
      <div className="app-panel-muted app-divider w-80 lg:w-96 border-r flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={onNavigateHome}
                className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <h1 className="text-lg font-black uppercase tracking-tighter">Drill Studio</h1>
            </div>
            <Button size="sm" onClick={handleCreateNew} className="h-8">
              <Plus className="w-4 h-4 mr-1" /> New
            </Button>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex bg-secondary/50 rounded-lg p-1">
            <button 
              onClick={() => setStudioMode('drills')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                studioMode === 'drills' 
                  ? "bg-background shadow text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Dumbbell className="w-3.5 h-3.5" /> Drills
            </button>
            <button 
              onClick={() => setStudioMode('templates')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                studioMode === 'templates' 
                  ? "bg-background shadow text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutTemplate className="w-3.5 h-3.5" /> Templates
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${studioMode}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border h-9 text-sm"
            />
          </div>
          
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === 'list' ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                )}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === 'grid' ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                )}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
            
            {/* Filters */}
            <Button 
              variant={showFilters ? "default" : "outline"} 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-9 px-2"
            >
              <Filter className="w-4 h-4 mr-1" />
              <span className="text-xs">Filters</span>
            </Button>
            
            {/* Star Toggle */}
            <button
              onClick={() => setShowStarredOnly(v => !v)}
              className={cn(
                "h-9 w-9 inline-flex items-center justify-center rounded-lg border transition-all",
                showStarredOnly
                  ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-300"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Star className={cn("w-4 h-4", showStarredOnly && "fill-current")} />
            </button>
            
            {/* Export */}
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9 px-2">
              <Download className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Expanded Filters */}
          {showFilters && studioMode === 'drills' && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex gap-2">
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Levels</SelectItem>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterIntensity} onValueChange={setFilterIntensity}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Intensity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Intensities</SelectItem>
                    <SelectItem value="Warm-Up">Warm-Up</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Hard Work">Hard Work</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setShowCategoryManager(true)} className="h-8 px-2 shrink-0">
                  <FolderOpen className="w-3.5 h-3.5" />
                </Button>
              </div>
              
              {/* Tag Filters */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {tags.slice(0, 8).map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.name)}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium transition-all",
                        selectedTags.includes(tag.name)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tag.name}
                    </button>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setShowTagManager(true)} className="h-5 px-2 text-[10px]">
                    <Tag className="w-3 h-3 mr-1" /> Manage
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isEditing ? (
            // Edit Form
            <div className="p-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                Editing {studioMode === 'drills' ? 'Drill' : 'Template'}
              </h3>
              
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">Name</label>
                <Input 
                  value={studioMode === 'drills' ? editForm?.name : editTemplateForm?.name} 
                  onChange={e => studioMode === 'drills' 
                    ? setEditForm(prev => prev ? {...prev, name: e.target.value} : null)
                    : setEditTemplateForm(prev => prev ? {...prev, name: e.target.value} : null)
                  } 
                  className="bg-background"
                />
              </div>
              
              {studioMode === 'drills' && editForm && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground">Session</label>
                      <Select value={editForm.session} onValueChange={(v) => setEditForm({...editForm, session: v as SessionType})}>
                        <SelectTrigger className="h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Private">Private</SelectItem>
                          <SelectItem value="Semi">Semi</SelectItem>
                          <SelectItem value="Group">Group</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground">Duration</label>
                      <Input type="number" className="h-9 text-xs" value={editForm.durationMins} onChange={e => setEditForm({...editForm, durationMins: Number(e.target.value)})} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground">Level</label>
                      <Select value={editForm.format} onValueChange={(v) => setEditForm({...editForm, format: v as Format})}>
                        <SelectTrigger className="h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Beginner">Beginner</SelectItem>
                          <SelectItem value="Intermediate">Intermediate</SelectItem>
                          <SelectItem value="Advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground">Intensity</label>
                      <Select value={editForm.intensity} onValueChange={(v) => setEditForm({...editForm, intensity: v as Intensity})}>
                        <SelectTrigger className="h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Warm-Up">Warm-Up</SelectItem>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Hard Work">Hard Work</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">Tags</label>
                    <Input
                      value={(editForm.tags || []).join(", ")}
                      onChange={(e) => setEditForm({...editForm, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean)})}
                      placeholder="e.g. forehand, serve"
                      className="text-xs"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">Description</label>
                    <textarea 
                      value={editForm.description || ''} 
                      onChange={e => setEditForm({...editForm, description: e.target.value})}
                      className="w-full min-h-[60px] bg-background border border-input rounded-md px-3 py-2 text-xs"
                    />
                  </div>
                </>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" size="sm" onClick={handleSave}>Save</Button>
                <Button variant="secondary" size="sm" onClick={handleCancel}>Cancel</Button>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            // Grid View
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setHoveredItem(item)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={cn(
                    "p-3 rounded-xl border cursor-pointer transition-all group",
                    activeId === item.id
                      ? "bg-primary/10 border-primary/50" 
                      : "bg-card/40 border-transparent hover:bg-secondary"
                  )}
                >
                  <div className="aspect-[2/1] rounded-lg bg-card border border-border/50 mb-2 overflow-hidden">
                    <DrillThumbnail drill={item} className="w-full h-full" variant="compact" />
                  </div>
                  <div className="font-semibold text-xs truncate">{item.name}</div>
                  {studioMode === 'drills' && (
                    <div className="flex gap-1 mt-1">
                      <span className={getBadgeStyles('level', item.format || '')}>{item.format}</span>
                      <span className={getBadgeStyles('intensity', item.intensity || '')}>{item.intensity}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : studioMode === 'drills' && groupedDrills ? (
            // Grouped List View (Drills)
            Object.entries(groupedDrills).map(([group, groupDrills]: [string, Drill[]]) => {
              if (groupDrills.length === 0) return null;
              return (
                <div key={group} className="mb-3">
                  <h3 className="px-2 mb-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    {group}
                  </h3>
                  <div className="space-y-1">
                    {groupDrills.map((drill) => (
                      <DrillListItem
                        key={drill.id}
                        item={drill}
                        isActive={activeDrillId === drill.id}
                        isDrill={true}
                        onSelect={() => handleSelectItem(drill)}
                        onEdit={() => handleEditClick(drill)}
                        onDuplicate={() => handleDuplicate(drill)}
                        onDelete={() => handleDelete(drill.id!)}
                        onStar={() => toggleStar(drill.id!)}
                        onHover={setHoveredItem}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            // Flat List View (Templates)
            filteredItems.map((item: any) => (
              <DrillListItem
                key={item.id}
                item={item}
                isActive={activeId === item.id}
                isDrill={studioMode === 'drills'}
                onSelect={() => handleSelectItem(item)}
                onEdit={() => handleEditClick(item)}
                onDuplicate={() => handleDuplicate(item)}
                onDelete={() => handleDelete(item.id)}
                onStar={() => toggleStar(item.id)}
                onHover={setHoveredItem}
              />
            ))
          )}
          
          {filteredItems.length === 0 && !isEditing && (
            <div className="text-center py-8 text-xs text-muted-foreground italic">
              No {studioMode} found.
            </div>
          )}
        </div>
      </div>
      
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {activeItem ? (
          <>
            <PlaybookDiagramV2 
              fill={true} 
              showHeader={true} 
              templates={templates}
              onSaveTemplate={handleSaveTemplateFromCanvas}
            />
            
            {/* Hover Preview */}
            {hoveredItem && hoveredItem.id !== activeId && (
              <div 
                className="absolute left-4 top-4 z-50 w-64 bg-popover border border-border rounded-xl shadow-2xl p-3 pointer-events-none"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Preview</span>
                  {'session' in hoveredItem && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded">{hoveredItem.session}</span>
                  )}
                </div>
                <DrillThumbnail drill={hoveredItem} className="w-full h-auto aspect-[2/1] rounded-lg bg-card border border-border/50" />
                <div className="mt-2 px-1">
                  <div className="font-bold text-sm">{hoveredItem.name}</div>
                  {'description' in hoveredItem && hoveredItem.description && (
                    <div className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{hoveredItem.description}</div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium">Select a {studioMode.slice(0, -1)} to edit</p>
              <p className="text-xs opacity-60 mt-1">or create a new one from the sidebar</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManager 
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onAdd={addCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
          onReset={resetToDefaults}
        />
      )}
      
      {/* Tag Manager Modal */}
      {showTagManager && (
        <TagManager 
          tags={tags}
          onClose={() => setShowTagManager(false)}
          onAdd={addTag}
          onDelete={deleteTag}
        />
      )}
    </div>
  );
}

// Sub-components

interface DrillListItemProps {
  item: Drill | DrillTemplate;
  isActive: boolean;
  isDrill: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStar: () => void;
  onHover: (item: Drill | DrillTemplate | null) => void;
}

function DrillListItem({ item, isActive, isDrill, onSelect, onEdit, onDuplicate, onDelete, onStar, onHover }: DrillListItemProps) {
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => onHover(item)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "w-full text-left p-3 rounded-lg border text-sm transition-all group relative cursor-pointer",
        isActive
          ? "bg-primary/10 border-primary/50 text-foreground" 
          : "bg-card/40 border-transparent hover:bg-secondary text-muted-foreground hover:text-foreground"
      )}
    >
      <div className="flex justify-between items-start">
        <div className="font-semibold truncate pr-6">{item.name}</div>
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onStar(); }} className={cn("p-1 hover:text-yellow-500", item.starred ? "text-yellow-500" : "text-muted-foreground")}>
            {item.starred ? <Star className="w-3 h-3 fill-current" /> : <StarOff className="w-3 h-3" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1 text-muted-foreground hover:text-foreground" title="Duplicate">
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-muted-foreground hover:text-primary" title="Edit">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-muted-foreground hover:text-red-500">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      {isDrill && 'format' in item && (
        <div className="flex gap-2 mt-1">
          <span className={getBadgeStyles('level', item.format || '')}>{item.format}</span>
          <span className={getBadgeStyles('intensity', item.intensity || '')}>{item.intensity}</span>
        </div>
      )}
      
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[9px] bg-secondary/50 px-1.5 py-0.5 rounded text-muted-foreground">
              {tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{item.tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Category Manager Component
function CategoryManager({ categories, onClose, onAdd, onUpdate, onDelete, onReset }: any) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleSave = (id: string) => {
    if (editName.trim()) {
      onUpdate(id, { name: editName.trim() });
    }
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">Manage Categories</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
          {categories.map((cat: any) => (
            <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
              {editingId === cat.id ? (
                <Input 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleSave(cat.id)}
                  onKeyDown={e => e.key === 'Enter' && handleSave(cat.id)}
                  className="flex-1 h-8"
                  autoFocus
                />
              ) : (
                <span className="flex-1 font-medium text-sm">{cat.name}</span>
              )}
              {!cat.isSystem && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(cat)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(cat.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              const newCat = onAdd({ name: 'New Category', color: '#6b7280' });
              setEditingId(newCat.id);
              setEditName('New Category');
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Category
          </Button>
        </div>
        <div className="p-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset to Defaults
          </Button>
        </div>
      </div>
    </div>
  );
}

// Tag Manager Component
function TagManager({ tags, onClose, onAdd, onDelete }: any) {
  const [newTagName, setNewTagName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">Manage Tags</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <Input 
              placeholder="New tag name..."
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newTagName.trim() && (onAdd(newTagName.trim()), setNewTagName(''))}
              className="flex-1"
            />
            <Button 
              onClick={() => { if (newTagName.trim()) { onAdd(newTagName.trim()); setNewTagName(''); } }}
              size="sm"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: any) => (
                <div 
                  key={tag.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-sm"
                >
                  <span>{tag.name}</span>
                  <span className="text-xs text-muted-foreground">({tag.usageCount})</span>
                  <button
                    onClick={() => onDelete(tag.id)}
                    className="ml-1 text-muted-foreground hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tags yet. Add tags to your drills to see them here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

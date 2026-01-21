import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { cn, nanoid, downloadTextFile } from '@/lib/utils';
import type { Drill, DrillCategory, DrillTag, DrillCollection } from '@/lib/playbook';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDrillCategories, useDrillTags, useDrillCollections, useDataExport, useDataImport } from '@/lib/hooks';
import { 
  Search, Filter, FolderOpen, Tag, Grid, List, Plus, 
  Settings, Download, Upload, Trash2, Edit2, Star, StarOff,
  X, ChevronDown, FolderPlus, FileUp
} from 'lucide-react';

interface DrillLibraryProps {
  drills: Drill[];
  onUpdateDrill: (drill: Drill) => void;
  onDeleteDrill: (id: string) => void;
  onSelectDrill: (drill: Drill) => void;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'name' | 'updated' | 'created' | 'level';

export function DrillLibrary({ drills, onUpdateDrill, onDeleteDrill, onSelectDrill }: DrillLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [showFilters, setShowFilters] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showCollectionManager, setShowCollectionManager] = useState(false);

  const { categories } = useDrillCategories();
  const { tags, addTag } = useDrillTags(drills);
  const { collections, createCollection } = useDrillCollections();
  const { exportData } = useDataExport();

  const filteredDrills = useMemo(() => {
    let result = [...drills];

    // Search filter
    if (deferredSearchQuery) {
      const query = deferredSearchQuery.toLowerCase();
      result = result.filter(d => 
        d.name.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query) ||
        d.coachingPoints?.toLowerCase().includes(query) ||
        d.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(d => d.categoryId === selectedCategory);
    }

    // Level filter
    if (selectedLevel !== 'all') {
      result = result.filter(d => d.format === selectedLevel);
    }

    // Tag filter
    if (selectedTags.length > 0) {
      result = result.filter(d => d.tags?.some(t => selectedTags.includes(t)));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'updated': return (b.updatedAt || 0) - (a.updatedAt || 0);
        case 'created': return (b.createdAt || 0) - (a.createdAt || 0);
        case 'level': return (a.format || '').localeCompare(b.format || '');
        default: return 0;
      }
    });

    return result;
  }, [drills, deferredSearchQuery, selectedCategory, selectedLevel, selectedTags, sortBy]);

  const handleExportLibrary = useCallback(() => {
    exportData({
      drills,
      categories,
      tags,
      collections,
    }, 'tennis-lab-library.json');
  }, [drills, categories, tags, collections, exportData]);

  const handleImportLibrary = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.drills) {
          // Handle import in parent component
          console.log('Import data:', data);
        }
      } catch (error) {
        console.error('Invalid import file');
      }
    };
    reader.readAsText(file);
  }, []);

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Drill Library</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {filteredDrills.length} drills
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCategoryManager(true)}>
              <FolderOpen className="w-4 h-4 mr-1" />
              Categories
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTagManager(true)}>
              <Tag className="w-4 h-4 mr-1" />
              Tags
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportLibrary}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <label className="Button variant-outline size-sm inline-flex items-center cursor-pointer">
              <Upload className="w-4 h-4 mr-1" />
              Import
              <input type="file" accept=".json" className="hidden" onChange={e => {
                if (e.target.files?.[0]) handleImportLibrary(e.target.files[0]);
              }} />
            </label>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search drills..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant={showFilters ? "default" : "outline"} 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Tags ({selectedTags.length})
          </Button>

          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 transition-colors",
                viewMode === 'grid' ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 transition-colors",
                viewMode === 'list' ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tag Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Filter by Tags
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.length > 0 ? (
                tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.name)}
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium transition-all",
                      selectedTags.includes(tag.name)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tag.name} ({tag.usageCount})
                  </button>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No tags yet</span>
              )}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="px-2 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredDrills.length > 0 ? (
          <div className={cn(
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-2"
          )}>
            {filteredDrills.map(drill => (
              <DrillCard
                drill={drill}
                category={categories.find(c => c.id === drill.categoryId)}
                viewMode={viewMode}
                onSelect={() => onSelectDrill(drill)}
                onUpdate={onUpdateDrill}
                onDelete={() => drill.id && onDeleteDrill(drill.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No drills found</p>
            <p className="text-sm">Try adjusting your filters or search query</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCategoryManager && (
        <CategoryManager onClose={() => setShowCategoryManager(false)} />
      )}
      {showTagManager && (
        <TagManager onClose={() => setShowTagManager(false)} tags={tags} />
      )}
    </div>
  );
}

// Drill Card Component
interface DrillCardProps {
  drill: Drill;
  category?: DrillCategory;
  viewMode: ViewMode;
  onSelect: () => void;
  onUpdate: (drill: Drill) => void;
  onDelete: () => void;
}

function DrillCard({ drill, category, viewMode, onSelect, onUpdate, onDelete }: DrillCardProps) {
  const content = (
    <div
      onClick={onSelect}
      className={cn(
        "group relative p-4 rounded-xl border bg-card/40 cursor-pointer transition-all hover:border-primary/50 hover:bg-card/60",
        viewMode === 'list' && "flex items-center gap-4"
      )}
    >
      {/* Category Badge */}
      {category && (
        <div 
          className={cn(
            "absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
            viewMode === 'list' && "static"
          )}
          style={{ 
            backgroundColor: `${category.color}20`,
            color: category.color,
            border: `1px solid ${category.color}40`
          }}
        >
          {category.name}
        </div>
      )}

      {/* Difficulty */}
      {drill.difficulty && (
        <div className="absolute bottom-2 right-2 flex gap-0.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div 
              key={i}
              className={cn(
                "w-1.5 h-3 rounded-sm",
                i <= drill.difficulty ? "bg-primary" : "bg-secondary"
              )}
            />
          ))}
        </div>
      )}

      <div className={cn("flex-1", viewMode === 'list' && "min-w-0")}>
        <h3 className="font-bold truncate">{drill.name}</h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{drill.format}</span>
          <span>•</span>
          <span>{drill.intensity}</span>
          {drill.durationMins && (
            <>
              <span>•</span>
              <span>{drill.durationMins} min</span>
            </>
          )}
        </div>

        {/* Tags */}
        {drill.tags && drill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {drill.tags.slice(0, 3).map(tag => (
              <span 
                key={tag}
                className="px-1.5 py-0.5 bg-secondary/50 rounded text-[10px]"
              >
                {tag}
              </span>
            ))}
            {drill.tags.length > 3 && (
              <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
                +{drill.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); onUpdate({ ...drill, starred: !drill.starred }); }}
          className="p-2 hover:text-yellow-500"
        >
          {drill.starred ? <Star className="w-4 h-4 fill-yellow-500" /> : <StarOff className="w-4 h-4" />}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-2 hover:text-red-500"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  if (viewMode === 'list') {
    return <div className="flex items-center gap-4">{content}</div>;
  }
  return content;
}

// Category Manager Modal
interface ModalProps {
  onClose: () => void;
}

function CategoryManager({ onClose }: ModalProps) {
  const { categories, addCategory, updateCategory, deleteCategory, resetToDefaults } = useDrillCategories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleEdit = (cat: DrillCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleSave = (id: string) => {
    if (editName.trim()) {
      updateCategory(id, { name: editName.trim() });
    }
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">Manage Categories</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              {editingId === cat.id ? (
                <Input 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleSave(cat.id)}
                  onKeyDown={e => e.key === 'Enter' && handleSave(cat.id)}
                  className="flex-1"
                  autoFocus
                />
              ) : (
                <span className="flex-1 font-medium">{cat.name}</span>
              )}
              <div className="flex items-center gap-1">
                {!cat.isSystem && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(cat)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteCategory(cat.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              const newCat = addCategory({ name: 'New Category', color: '#6b7280' });
              setEditingId(newCat.id);
              setEditName('New Category');
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Category
          </Button>
        </div>
        <div className="p-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={resetToDefaults}>
            Reset to Defaults
          </Button>
        </div>
      </div>
    </div>
  );
}

// Tag Manager Modal
function TagManager({ onClose, tags }: { onClose: () => void; tags: DrillTag[] }) {
  const { addTag, renameTag, deleteTag } = useDrillTags([]);
  const [newTagName, setNewTagName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">Manage Tags</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          <div className="flex gap-2">
            <Input 
              placeholder="New tag name..."
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newTagName.trim() && (addTag(newTagName.trim()), setNewTagName(''))}
              className="flex-1"
            />
            <Button 
              onClick={() => { if (newTagName.trim()) { addTag(newTagName.trim()); setNewTagName(''); } }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-4">
              {tags.map(tag => (
                <div 
                  key={tag.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-sm"
                >
                  <span>{tag.name}</span>
                  <span className="text-xs text-muted-foreground">({tag.usageCount})</span>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="ml-1 text-muted-foreground hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No custom tags. Add tags to your drills to see them here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

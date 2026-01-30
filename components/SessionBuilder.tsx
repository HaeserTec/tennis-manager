import React from 'react';
import { Drill, SessionPlan, PlanItem } from '@/lib/playbook';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { arrayMove, cn, nanoid } from '@/lib/utils';
import { DrillThumbnail } from '@/components/DrillThumbnail';
import { SessionPlanDocument } from '@/components/SessionPlanDocument';
import { LogoSvg } from '@/components/Logo';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface SessionBuilderProps {
  drills: Drill[];
  plan: SessionPlan;
  onUpdatePlan: (plan: SessionPlan) => void;
}

const MAX_PLAN_DRILLS = 3;

// Icons
const PrinterIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect width="12" height="8" x="6" y="14"></rect></svg>
);
const DownloadIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>
);
const GripVerticalIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
);
const Trash2Icon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>
);
const PlusIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
);
const EyeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const PencilIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
);

export function SessionBuilder({ drills, plan, onUpdatePlan }: SessionBuilderProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const [isPreviewMode, setIsPreviewMode] = React.useState(false);
  const [hoveredDrill, setHoveredDrill] = React.useState<Drill | null>(null);
  const [isDrillDrawerOpen, setIsDrillDrawerOpen] = React.useState(false);
  const [drawerOffset, setDrawerOffset] = React.useState(0);
  const [isDrawerDragging, setIsDrawerDragging] = React.useState(false);
  const drawerStartY = React.useRef<number | null>(null);
  const drawerRef = React.useRef<HTMLDivElement | null>(null);
  const [draggingItemId, setDraggingItemId] = React.useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = React.useState<string | null>(null);
  const printRef = React.useRef<HTMLDivElement>(null);
  const sidebarRef = React.useRef<HTMLDivElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = React.useState(320);
  const [isResizingSidebar, setIsResizingSidebar] = React.useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdatePlan({ ...plan, name: e.target.value });
  };

  const handleAddDrill = (drill: Drill) => {
    if (plan.items.length >= MAX_PLAN_DRILLS) {
      window.alert(`Plan limit reached. You can only add up to ${MAX_PLAN_DRILLS} drills.`);
      return;
    }
    const newItem: PlanItem = {
      id: nanoid(),
      drillId: drill.id || nanoid(),
      drill: drill,
      durationMins: drill.durationMins || 10,
    };
    onUpdatePlan({ ...plan, items: [...plan.items, newItem] });
  };

  const handleRemoveItem = (itemId: string) => {
    onUpdatePlan({ ...plan, items: plan.items.filter(item => item.id !== itemId) });
  };

  const reorderPlanItems = React.useCallback(
    (activeId: string, overId: string) => {
      if (activeId === overId) return;
      const from = plan.items.findIndex((i) => i.id === activeId);
      const to = plan.items.findIndex((i) => i.id === overId);
      if (from < 0 || to < 0) return;
      onUpdatePlan({ ...plan, items: arrayMove(plan.items, from, to) });
    },
    [plan, onUpdatePlan]
  );

  const handleExportPDF = async () => {
    if (!printRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      // Ensure we are in a mode where the document is visible
      const element = printRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2, // Higher resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: element.offsetWidth,
        windowWidth: element.offsetWidth,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Handle multi-page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${plan.name || 'session-plan'}.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const closeDrillDrawer = () => {
    setIsDrillDrawerOpen(false);
    setDrawerOffset(0);
    setIsDrawerDragging(false);
    drawerStartY.current = null;
  };

  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    drawerStartY.current = e.touches[0]?.clientY ?? null;
    setIsDrawerDragging(true);
  };

  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    if (drawerStartY.current === null) return;
    const delta = e.touches[0]?.clientY - drawerStartY.current;
    if (delta > 0) setDrawerOffset(delta);
  };

  const handleDrawerTouchEnd = () => {
    if (!isDrawerDragging) return;
    if (drawerOffset > 80) {
      closeDrillDrawer();
      return;
    }
    setDrawerOffset(0);
    setIsDrawerDragging(false);
    drawerStartY.current = null;
  };

  React.useEffect(() => {
    if (!isResizingSidebar) return;
    const handleMove = (event: PointerEvent) => {
      if (!sidebarRef.current) return;
      const { right } = sidebarRef.current.getBoundingClientRect();
      const nextWidth = Math.min(520, Math.max(240, right - event.clientX));
      setSidebarWidth(nextWidth);
    };
    const handleUp = () => setIsResizingSidebar(false);
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
  }, [isResizingSidebar]);

  const handleSidebarResizeStart = React.useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const renderDrillList = (options: { closeOnAdd?: boolean; enableHover?: boolean } = {}) => (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {drills.map((drill) => (
        <div
          key={drill.id}
          className="p-3 bg-card border border-border rounded-md hover:border-primary/50 transition-colors cursor-pointer group"
          onClick={() => {
            handleAddDrill(drill);
            if (options.closeOnAdd) closeDrillDrawer();
          }}
          onMouseEnter={options.enableHover ? () => setHoveredDrill(drill) : undefined}
          onMouseLeave={options.enableHover ? () => setHoveredDrill(null) : undefined}
        >
          <div className="flex justify-between items-start">
            <h4 className="font-medium text-sm">{drill.name}</h4>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 -mr-2 -mt-2"
              aria-label="Add drill"
              onClick={(event) => {
                event.stopPropagation();
                handleAddDrill(drill);
                if (options.closeOnAdd) closeDrillDrawer();
              }}
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
            <span>{drill.intensity}</span>
            <span>•</span>
            <span>{drill.format}</span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground relative print:bg-white print:text-black">
      {/* Top Bar - Hidden when printing */}
      <div className="flex flex-col gap-3 p-4 border-b border-border bg-card/50 sm:flex-row sm:items-center sm:justify-between no-print print:hidden">
        <Input
          value={plan.name.toUpperCase()}
          onChange={handleNameChange}
          className="text-xl font-bold bg-transparent border-none focus-visible:ring-0 px-0 h-auto w-full sm:w-[300px]"
          placeholder="Session Plan Name"
        />
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button
              variant="secondary"
              size="sm"
              className="sm:hidden"
              onClick={() => {
                setIsDrillDrawerOpen(true);
                setDrawerOffset(0);
                setIsDrawerDragging(false);
              }}
            >
              Add Drills
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsPreviewMode(!isPreviewMode)} 
              className={cn("gap-2", isPreviewMode && "bg-primary/10 text-primary")}
            >
               {isPreviewMode ? <PencilIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
               <span className="hidden sm:inline">{isPreviewMode ? "Edit Mode" : "Preview PDF"}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
              <PrinterIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleExportPDF} 
              disabled={isGeneratingPdf} 
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <DownloadIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Save PDF'}</span>
            </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden lg:flex-row print:overflow-visible print:block">
        
        {/* Main Workspace */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-background print:overflow-visible print:bg-white print:block">
          
          {/* Editor View (Drag & Drop) - Hidden in Preview or Print */}
          <div className={cn(
            "p-4 space-y-3 max-w-3xl mx-auto w-full",
            isPreviewMode ? "hidden" : "block print:hidden"
          )}>
             {plan.items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                <p>No drills in this plan yet.</p>
                <p className="text-sm">Select drills from the sidebar to add them.</p>
              </div>
            ) : (
              plan.items.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => {
                    setDraggingItemId(item.id);
                    setDragOverItemId(item.id);
                  }}
                  onDragEnd={() => {
                    setDraggingItemId(null);
                    setDragOverItemId(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverItemId !== item.id) setDragOverItemId(item.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!draggingItemId || !dragOverItemId) return;
                    reorderPlanItems(draggingItemId, dragOverItemId);
                    setDraggingItemId(null);
                    setDragOverItemId(null);
                  }}
                  className={cn(
                    "group relative bg-card border border-border rounded-lg p-3 shadow-sm transition-all hover:border-primary/50",
                    draggingItemId === item.id && "ring-2 ring-primary/40 opacity-50",
                    dragOverItemId === item.id && draggingItemId && draggingItemId !== item.id && "border-primary/70 ring-2 ring-primary/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1 text-muted-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVerticalIcon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
                            <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                {index + 1}
                            </span>
                            <h2 className="font-bold text-base truncate">{item.drill.name}</h2>
                        </div>
                        <div className="flex gap-3 text-[10px] text-muted-foreground mb-2">
                           {item.drill.durationMins && <span className="flex items-center gap-1">⏱ {item.drill.durationMins}m</span>}
                           {item.drill.intensity && <span className="flex items-center gap-1">💪 {item.drill.intensity}</span>}
                           {item.drill.format && <span className="flex items-center gap-1">👥 {item.drill.format}</span>}
                        </div>
                        {item.drill.description && (
                             <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.drill.description}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Document View (Preview / Print / PDF) */}
          <div className={cn(
            "flex justify-center p-4 print:p-0",
            isPreviewMode ? "block" : "hidden print:block"
          )}>
             <div ref={printRef} className="print:w-full">
                <SessionPlanDocument plan={plan} />
             </div>
          </div>
        </div>

        {/* Drills Sidebar - Hidden when printing or previewing */}
        <div
          ref={sidebarRef}
          style={{ '--session-sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
          className={cn(
            "border-l border-border bg-card/50 flex-col no-print relative lg:w-[var(--session-sidebar-width)]",
            isPreviewMode ? "hidden" : "hidden lg:flex",
            isResizingSidebar ? "transition-none" : "transition-all"
          )}
        >
          <div
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            onPointerDown={handleSidebarResizeStart}
            className="absolute left-0 top-0 h-full w-1 cursor-col-resize touch-none bg-transparent hover:bg-primary/30"
          />
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Available Drills</h3>
          </div>
          {renderDrillList({ enableHover: true })}
          
          {/* Sidebar Hover Preview */}
          {hoveredDrill && !isPreviewMode && (
             <div 
                className="absolute top-4 z-50 hidden w-72 bg-background border border-border rounded-xl shadow-2xl p-3 pointer-events-none lg:block"
                style={{ right: `calc(${sidebarWidth}px + 10px)` }}
             >
                <div className="mb-2 flex items-center justify-between">
                   <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Quick Preview</span>
                   <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded">{hoveredDrill.session}</span>
                </div>
                <DrillThumbnail drill={hoveredDrill} className="w-full h-auto aspect-[2/1] rounded-lg bg-card border border-border/50" />
                <div className="mt-3 px-1 space-y-1">
                   <div className="font-bold text-sm text-foreground leading-tight">{hoveredDrill.name}</div>
                   <div className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">{hoveredDrill.description || "No description available."}</div>
                </div>
             </div>
          )}
        </div>
      </div>

      {isDrillDrawerOpen && !isPreviewMode && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeDrillDrawer}
          />
          <div
            ref={drawerRef}
            className={cn(
              "absolute inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl border border-border bg-card/95 shadow-2xl",
              isDrawerDragging ? "transition-none" : "transition-transform duration-200 ease-out"
            )}
            style={{ transform: `translateY(${drawerOffset}px)` }}
          >
            <div
              className="flex flex-col gap-3 border-b border-border p-4 touch-none select-none"
              onTouchStart={handleDrawerTouchStart}
              onTouchMove={handleDrawerTouchMove}
              onTouchEnd={handleDrawerTouchEnd}
              onTouchCancel={handleDrawerTouchEnd}
            >
              <div className="mx-auto h-1.5 w-10 rounded-full bg-muted" />
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Available Drills</h3>
                <Button size="icon" variant="ghost" onClick={closeDrillDrawer}>
                   <span className="sr-only">Close</span>
                   <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.1929 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.1929 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                </Button>
              </div>
            </div>
            {renderDrillList({ closeOnAdd: true })}
          </div>
        </div>
      )}
    </div>
  );
}
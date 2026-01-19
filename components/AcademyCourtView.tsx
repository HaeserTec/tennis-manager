import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Player } from '@/lib/playbook';

interface AcademyCourtViewProps {
  players: Player[];
  onSelectPlayer: (id: string) => void;
  onUpdatePlayerPos: (id: string, pos: { x: number; y: number }) => void;
}

// Fixed constants to match PlaybookDiagramV2 for perfect consistency
const BASE_WIDTH = 1320;
const BASE_HEIGHT = 660;
const COURT_PAD = 100;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function AcademyCourtView({ players, onSelectPlayer, onUpdatePlayerPos }: AcademyCourtViewProps) {
  const [hoveredPlayerId, setHoveredPlayerId] = React.useState<string | null>(null);
  const [draggingPlayerId, setDraggingPlayerId] = React.useState<string | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const playerRefs = React.useRef(new Map<string, SVGGElement>());
  const dragStateRef = React.useRef<{
    id: string;
    offset: { x: number; y: number };
    startPos: { x: number; y: number };
    pending: { x: number; y: number } | null;
    rafId: number | null;
  } | null>(null);
  
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  React.useEffect(() => {
    return () => {
      const dragState = dragStateRef.current;
      if (dragState && dragState.rafId !== null) {
        cancelAnimationFrame(dragState.rafId);
      }
    };
  }, []);

  // Calculate positions for players (use saved pos if exists, otherwise randomize)
  const playerPositions = useMemo(() => {
    const lengthPx = BASE_WIDTH - COURT_PAD * 2;
    const widthPxDbl = (10.97 / 23.77) * lengthPx;
    
    const centerX = BASE_WIDTH / 2;
    const centerY = BASE_HEIGHT / 2;
    
    const minX = centerX - lengthPx / 2 + 40;
    const maxX = centerX + lengthPx / 2 - 40;
    const minY = centerY - widthPxDbl / 2 + 40;
    const maxY = centerY + widthPxDbl / 2 - 40;

    return players.map((p) => {
      if (p.academyPos) {
        return { ...p, x: p.academyPos.x, y: p.academyPos.y };
      }
      
      const seed = p.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const randomX = minX + (seed % 100 / 100) * (maxX - minX);
      const randomY = minY + ((seed * 13) % 100 / 100) * (maxY - minY);
      
      return {
        id: p.id,
        name: p.name,
        avatarColor: p.avatarColor,
        avatarUrl: p.avatarUrl,
        level: p.level,
        assignedDrills: p.assignedDrills,
        attendance: p.attendance,
        x: randomX,
        y: randomY
      };
    });
  }, [players]);

  const getSvgPoint = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const inv = svg.getScreenCTM()?.inverse();
    if (!inv) return { x: 0, y: 0 };
    
    let cx = 0, cy = 0;
    if ('touches' in e && e.touches.length > 0) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
    } else if ('clientX' in e) {
        cx = e.clientX;
        cy = e.clientY;
    }

    const p = new DOMPoint(cx, cy).matrixTransform(inv);
    return { x: p.x, y: p.y };
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const pt = getSvgPoint(e as any);
    const player = playerPositions.find(p => p.id === id);
    if (!player) return;

    setDraggingPlayerId(id);
    dragStateRef.current = {
      id,
      offset: { x: pt.x - player.x, y: pt.y - player.y },
      startPos: { x: player.x, y: player.y },
      pending: { x: player.x, y: player.y },
      rafId: null,
    };
    setHoveredPlayerId(null);
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const pt = getSvgPoint(e as any);
    const newX = clamp(pt.x - dragState.offset.x, 50, BASE_WIDTH - 50);
    const newY = clamp(pt.y - dragState.offset.y, 50, BASE_HEIGHT - 50);
    
    // We update local state via prop in onPointerUp to persist
    // But for smooth dragging, we could use a local temp state
    // For now let's just use onUpdatePlayerPos directly if we want instant persistence
    // but better to do it on release to avoid storage spam.
    dragState.pending = { x: newX, y: newY };
    if (dragState.rafId === null) {
      dragState.rafId = requestAnimationFrame(() => {
        const state = dragStateRef.current;
        if (!state || !state.pending) return;
        const node = playerRefs.current.get(state.id);
        if (node) {
          node.setAttribute('transform', `translate(${state.pending.x} ${state.pending.y})`);
        }
        state.pending = null;
        state.rafId = null;
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState) {
      setDraggingPlayerId(null);
      return;
    }

    const pt = getSvgPoint(e as any);
    // Safety Clamping: Ensure they stay within the court viewbox
    const newX = Math.round(clamp(pt.x - dragState.offset.x, 50, BASE_WIDTH - 50));
    const newY = Math.round(clamp(pt.y - dragState.offset.y, 50, BASE_HEIGHT - 50));

    const node = playerRefs.current.get(dragState.id);
    if (node) node.setAttribute('transform', `translate(${newX} ${newY})`);
    onUpdatePlayerPos(dragState.id, { x: newX, y: newY });
    
    // If they didn't move much, treat as a click/select
    if (Math.abs(newX - dragState.startPos.x) < 5 && Math.abs(newY - dragState.startPos.y) < 5) {
      onSelectPlayer(dragState.id);
    }

    setDraggingPlayerId(null);
    if (dragState.rafId !== null) {
      cancelAnimationFrame(dragState.rafId);
    }
    dragStateRef.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const handleResetPositions = () => {
     players.forEach(p => onUpdatePlayerPos(p.id, undefined as any));
  };

  const drawCourtLines = () => {
    const M_LEN = 23.77;
    const M_W_DOUBLES = 10.97;
    const M_W_SINGLES = 8.23;
    const M_SERVICE_FROM_NET = 6.40;

    const lengthPx = BASE_WIDTH - COURT_PAD * 2;
    const widthPxDbl = (M_W_DOUBLES / M_LEN) * lengthPx;

    const centerX = BASE_WIDTH / 2;
    const centerY = BASE_HEIGHT / 2;
    
    const leftBaseX = centerX - lengthPx / 2;
    const rightBaseX = centerX + lengthPx / 2;
    
    const topSideY = centerY - widthPxDbl / 2;
    const bottomSideY = centerY + widthPxDbl / 2;

    const serviceOffsetPx = (M_SERVICE_FROM_NET / M_LEN) * lengthPx;
    const leftServiceX = centerX - serviceOffsetPx;
    const rightServiceX = centerX + serviceOffsetPx;

    const singlesWidthPx = (M_W_SINGLES / M_LEN) * lengthPx;
    const topSingleY = centerY - singlesWidthPx / 2;
    const bottomSingleY = centerY + singlesWidthPx / 2;

    return (
      <g stroke="#ffffff" strokeOpacity={0.15} strokeWidth={2} fill="none">
        <rect x={leftBaseX} y={topSideY} width={lengthPx} height={widthPxDbl} />
        <line x1={centerX} y1={topSideY - 10} x2={centerX} y2={bottomSideY + 10} strokeWidth={3} />
        <line x1={leftBaseX} y1={topSideY} x2={leftBaseX} y2={bottomSideY} strokeWidth={4} />
        <line x1={rightBaseX} y1={topSideY} x2={rightBaseX} y2={bottomSideY} strokeWidth={4} />
        <line x1={leftServiceX} y1={topSingleY} x2={leftServiceX} y2={bottomSingleY} />
        <line x1={rightServiceX} y1={topSingleY} x2={rightServiceX} y2={bottomSingleY} />
        <line x1={leftServiceX} y1={centerY} x2={rightServiceX} y2={centerY} />
        <line x1={leftBaseX} y1={topSingleY} x2={rightBaseX} y2={topSingleY} />
        <line x1={leftBaseX} y1={bottomSingleY} x2={rightBaseX} y2={bottomSingleY} />
      </g>
    );
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#0c0f14] overflow-hidden group">
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`} 
        className="w-full h-full max-h-[85vh] transition-transform duration-1000 ease-out touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Denser Grid Background */}
        <g opacity={0.04}>
           {Array.from({ length: 80 }).map((_, i) => (
              <line key={`v-${i}`} x1={i * (BASE_WIDTH / 80)} y1={0} x2={i * (BASE_WIDTH / 80)} y2={BASE_HEIGHT} stroke="white" strokeWidth="0.5" />
           ))}
           {Array.from({ length: 40 }).map((_, i) => (
              <line key={`h-${i}`} x1={0} y1={i * (BASE_HEIGHT / 40)} x2={BASE_WIDTH} y2={i * (BASE_HEIGHT / 40)} stroke="white" strokeWidth="0.5" />
           ))}
        </g>

        {drawCourtLines()}

        {/* Player Avatars */}
        {playerPositions.map((pos) => {
          const initials = pos.name.split(/\s+/).filter(Boolean).map((n: string) => n[0]).join('').toUpperCase();
          const labelWidth = Math.max(30, initials.length * 12);

          return (
            <g 
              key={pos.id} 
              ref={(node) => {
                if (node) {
                  playerRefs.current.set(pos.id, node);
                } else {
                  playerRefs.current.delete(pos.id);
                }
              }}
              transform={`translate(${pos.x} ${pos.y})`}
              className={cn("cursor-grab", draggingPlayerId === pos.id && "cursor-grabbing opacity-50")}
              onPointerDown={(e) => handlePointerDown(e, pos.id)}
              onMouseEnter={() => !draggingPlayerId && setHoveredPlayerId(pos.id)}
              onMouseLeave={() => setHoveredPlayerId(null)}
            >
              {/* Pulsing Aura */}
              <circle 
                 cx={0} 
                 cy={0} 
                 r="35" 
                 fill={pos.avatarColor} 
                 fillOpacity={hoveredPlayerId === pos.id ? 0.15 : 0.05} 
                 className={cn("transition-all duration-300", hoveredPlayerId === pos.id ? "scale-110" : "animate-pulse")}
              />
              
              {/* Identity Ring */}
              <circle 
                 cx={0} 
                 cy={0} 
                 r="26" 
                 fill="transparent" 
                 stroke={pos.avatarColor} 
                 strokeWidth={hoveredPlayerId === pos.id ? "4" : "3"}
                 style={{ filter: `drop-shadow(0 0 ${hoveredPlayerId === pos.id ? '12px' : '8px'} ${pos.avatarColor}66)` }}
                 className="transition-all duration-300"
              />

              {/* Avatar Circle */}
              <defs>
                 <clipPath id={`clip-${pos.id}`}>
                    <circle cx={0} cy={0} r="24" />
                 </clipPath>
              </defs>
              
              <g clipPath={`url(#clip-${pos.id})`}>
                 <rect 
                    x={-24} 
                    y={-24} 
                    width="48" 
                    height="48" 
                    fill={pos.avatarUrl ? "#000" : `${pos.avatarColor}33`} 
                 />
                 {pos.avatarUrl ? (
                    <image 
                       href={pos.avatarUrl} 
                       x={-24} 
                       y={-24} 
                       width="48" 
                       height="48" 
                       preserveAspectRatio="xMidYMid slice" 
                    />
                 ) : (
                    <text 
                       x={0} 
                       y={0} 
                       textAnchor="middle" 
                       dominantBaseline="central" 
                       fill="white" 
                       fontSize={initials.length > 2 ? "11" : "14"} 
                       fontWeight="900"
                    >
                       {initials}
                    </text>
                 )}
              </g>

              {/* Initials Label */}
              <rect 
                 x={-(labelWidth / 2)} 
                 y={32} 
                 width={labelWidth} 
                 height={16} 
                 rx="4" 
                 fill={hoveredPlayerId === pos.id ? pos.avatarColor : "black"} 
                 fillOpacity={hoveredPlayerId === pos.id ? 0.8 : 0.6} 
                 className="transition-colors duration-300"
              />
              <text 
                 x={0} 
                 y={43} 
                 textAnchor="middle" 
                 fill="white" 
                 fontSize="9" 
                 fontWeight="900"
                 className="uppercase tracking-tighter"
              >
                 {initials}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover Info Card */}
      {hoveredPlayerId && (
         <div 
            className="fixed z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
            style={{ 
               left: `calc(var(--mouse-x, 0px) + 20px)`,
               top: `calc(var(--mouse-y, 0px) - 40px)`
            }}
         >
            {players.filter(p => p.id === hoveredPlayerId).map(p => (
               <div key={p.id} className="bg-card/90 backdrop-blur-md border border-border p-3 rounded-xl shadow-2xl space-y-2">
                  <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-full border-2" style={{ borderColor: p.avatarColor, backgroundColor: `${p.avatarColor}33` }}>
                        {p.avatarUrl ? <img src={p.avatarUrl} className="h-full w-full rounded-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] font-bold">{p.name.substring(0,2).toUpperCase()}</div>}
                     </div>
                     <div>
                        <div className="text-xs font-bold text-foreground uppercase tracking-tight">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{p.level}</div>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <div className="px-2 py-0.5 rounded bg-card/60 border border-border text-[9px] text-muted-foreground">
                        {p.assignedDrills.length} Drills
                     </div>
                     <div className="px-2 py-0.5 rounded bg-card/60 border border-border text-[9px] text-muted-foreground">
                        {p.attendance?.length || 0} Sessions
                     </div>
                  </div>
               </div>
            ))}
         </div>
      )}

      {/* Floating Info Overlay */}
      <div className="absolute top-10 left-10 pointer-events-none space-y-1">
         <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Academy Roster</div>
         <div className="text-2xl font-black italic tracking-tighter text-foreground uppercase">The Squad</div>
      </div>

      <div className="absolute bottom-10 right-10 flex flex-col items-end pointer-events-none opacity-40">
         <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Select a player to view profiles</div>
         <div className="h-px w-32 bg-border/60 mt-2 mb-4" />
         <button 
            onClick={handleResetPositions}
            className="pointer-events-auto px-3 py-1 rounded bg-card border border-border text-[9px] text-muted-foreground hover:text-foreground transition-colors uppercase font-bold tracking-widest"
         >
            Reset All Positions
         </button>
      </div>
    </div>
  );
}

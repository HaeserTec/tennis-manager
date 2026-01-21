
"use client";

import * as React from "react";
import { nanoid } from "@/lib/utils";
import type { DrillTemplate, Drill, Intensity, Session, Format } from "@/lib/playbook";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { RadialMenu } from "@/components/RadialMenu";

type NodeType =
  | "coach"
  | "player"
  | "target"
  | "targetBox"
  | "targetLine"
  | "ball"
  | "text"
  | "cone"
  | "feeder"
  | "ladder";

type DiagramNode = {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  r: number;
  label?: string;
  color?: string;
  size?: number;
};

type PathType = 'linear' | 'curve';
type ArrowHeadType = 'filled' | 'outlined';
type LineStyle = 'solid' | 'dashed' | 'dotted';

type DiagramPath = {
  id: string;
  points: Array<{ x: number; y: number }>;
  color?: string;
  width?: number;
  pathType?: PathType;
  arrowHead?: ArrowHeadType;
  lineStyle?: LineStyle;
};

type DiagramState = {
  nodes: DiagramNode[];
  paths: DiagramPath[];
};

type CourtSurface = 'blueprint' | 'hard' | 'clay' | 'grass' | 'elite';

const STORAGE_KEY = "ui.playbook.diagram.v2";
// Base width for landscape, extended for baselines: 1200 (original) + 60 (left) + 60 (right) = 1320
const BASE_WIDTH = 1320; 
// Base height for landscape, no change: 660
const BASE_HEIGHT = 660;
const COURT_PAD = 100; // Original padding for court lines from viewBox edge

const DEFAULT_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Green", value: "#10b981" },
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#2563eb" },
  { name: "Yellow", value: "#ffd600" },
  { name: "Magenta", value: "#d946ef" },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getBezierPoint(t: number, p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}) {
  const invT = 1 - t;
  return {
    x: invT * invT * p0.x + 2 * invT * t * p1.x + t * t * p2.x,
    y: invT * invT * p0.y + 2 * invT * t * p1.y + t * t * p2.y,
  };
}

function getPolylinePoint(t: number, points: {x:number, y:number}[]) {
  if (points.length < 2) return points[0] || {x:0,y:0};
  
  let totalLen = 0;
  const segLens: number[] = [];
  for(let i=0; i<points.length-1; i++) {
    const dx = points[i+1].x - points[i].x;
    const dy = points[i+1].y - points[i].y;
    const d = Math.sqrt(dx*dx + dy*dy);
    totalLen += d;
    segLens.push(d);
  }
  
  if (totalLen === 0) return points[0];

  const targetLen = t * totalLen;
  let currentLen = 0;
  
  for(let i=0; i<segLens.length; i++) {
     if (currentLen + segLens[i] >= targetLen) {
        const segT = (targetLen - currentLen) / segLens[i];
        return {
           x: points[i].x + (points[i+1].x - points[i].x) * segT,
           y: points[i].y + (points[i+1].y - points[i].y) * segT
        };
     }
     currentLen += segLens[i];
  }
  return points[points.length-1];
}

function loadState(): DiagramState {
  if (typeof window === "undefined") return { nodes: [], paths: [] } as any;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nodes: [], paths: [] } as any;
    const parsed = JSON.parse(raw) as DiagramState;
    if (!parsed || !Array.isArray((parsed as any).nodes)) return { nodes: [], paths: [] } as any;
    const anyParsed: any = parsed as any;
    return {
      nodes: anyParsed.nodes.map((n: any) => ({
        id: typeof n.id === "string" ? n.id : nanoid(),
        type: (n.type as NodeType) ?? "target",
        x: typeof n.x === "number" ? n.x : BASE_WIDTH / 2,
        y: typeof n.y === "number" ? n.y : BASE_HEIGHT / 2,
        r: typeof n.r === "number" ? n.r : 0,
        label: typeof n.label === "string" ? n.label : undefined,
        color: typeof n.color === "string" ? n.color : undefined,
        size: typeof n.size === "number" ? n.size : undefined,
      })),
      paths: Array.isArray(anyParsed.paths)
        ? anyParsed.paths.map((p: any) => ({
            id: typeof p.id === "string" ? p.id : nanoid(),
            color: typeof p.color === "string" ? p.color : undefined,
            width: typeof p.width === "number" ? p.width : undefined,
            pathType: p.pathType === 'curve' ? 'curve' : 'linear',
            arrowHead: p.arrowHead === 'outlined' ? 'outlined' : 'filled',
            lineStyle: p.lineStyle ? p.lineStyle : (p.dashed ? 'dashed' : 'solid'),
            points: Array.isArray(p.points)
              ? p.points.map((pt: any) => ({ x: Number(pt.x) || 0, y: Number(pt.y) || 0 }))
              : [],
          }))
        : [],
    };
  } catch {
    return { nodes: [], paths: [] } as any;
  }
}

function saveState(state: DiagramState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

interface PlaybookDiagramRef {
  addBall: () => void;
  addCone: () => void;
  addText: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  exportJSON: () => void;
  exportPNG: () => Promise<void>;
}

type PlaybookDiagramProps = {
  fill?: boolean;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  showHeader?: boolean;
  templates?: DrillTemplate[];
  onSaveTemplate?: (name: string) => void;
  disablePersistence?: boolean;
  isBackground?: boolean;
};

export const PlaybookDiagramV2 = React.forwardRef<PlaybookDiagramRef, PlaybookDiagramProps>(
  ({ fill = false, viewBoxWidth, viewBoxHeight, showHeader = true, templates = [], onSaveTemplate, disablePersistence = false, isBackground = false }, ref) => {
  
  const [orientation, setOrientation] = React.useState<'landscape' | 'portrait'>(() => {
    if (typeof window !== 'undefined') {
       return window.innerWidth < 768 ? 'portrait' : 'landscape';
    }
    return 'landscape';
  });
  const [showShortcuts, setShowShortcuts] = React.useState(false);
  const [courtSurface, setCourtSurface] = React.useState<CourtSurface>('blueprint');
  const [toolbarCollapsed, setToolbarCollapsed] = React.useState(false);
  const [toolbarPos, setToolbarPos] = React.useState<{ x: number; y: number } | null>(null);
  const [toolbarDragging, setToolbarDragging] = React.useState(false);

  // Determine ViewBox dimensions based on orientation
  // If props are passed, we treat them as the "Landscape" baseline
  const landscapeW = typeof viewBoxWidth === 'number' ? viewBoxWidth : BASE_WIDTH;
  const landscapeH = typeof viewBoxHeight === 'number' ? viewBoxHeight : BASE_HEIGHT;

  const VB_WIDTH = orientation === 'landscape' ? landscapeW : landscapeH;
  const VB_HEIGHT = orientation === 'landscape' ? landscapeH : landscapeW;

  const vbTrimTop = 0;     
  const vbTrimBottom = 0; 
  const vbY = vbTrimTop;
  const vbH = VB_HEIGHT - vbTrimTop - vbTrimBottom;
  const vbTrimLeft = 0;   
  const vbTrimRight = 0;  
  const vbX = vbTrimLeft;
  const vbW = VB_WIDTH - vbTrimLeft - vbTrimRight;

  const [state, setState] = React.useState<DiagramState>({ nodes: [], paths: [] });
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  
  const primarySelectedId = selectedIds[0] ?? null;
  const primaryNode = primarySelectedId ? state.nodes.find((n) => n.id === primarySelectedId) ?? null : null;
  const primaryPath = primarySelectedId ? state.paths.find((p) => p.id === primarySelectedId) ?? null : null;

  // Calculate bounds of selection for context menu positioning
  const selectionBounds = React.useMemo(() => {
    if (selectedIds.length === 0) return null;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let hasItems = false;

    // Check nodes
    state.nodes.forEach(n => {
      if (selectedIds.includes(n.id)) {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y);
        hasItems = true;
      }
    });

    // Check paths
    state.paths.forEach(p => {
      if (selectedIds.includes(p.id)) {
        p.points.forEach(pt => {
          minX = Math.min(minX, pt.x);
          maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y);
          maxY = Math.max(maxY, pt.y);
        });
        hasItems = true;
      }
    });

    if (!hasItems) return null;

    return {
      centerX: (minX + maxX) / 2,
      minY: minY,
    };
  }, [selectedIds, state.nodes, state.paths]);

  const [dragging, setDragging] = React.useState<null | {
    startMouse: { x: number; y: number };
    hasMoved: boolean;
  }>(null);

  const [draggingHandle, setDraggingHandle] = React.useState<null | { pathId: string; handleIndex: number }>(null);

  const [history, setHistory] = React.useState<DiagramState[]>([]);
  const [future, setFuture] = React.useState<DiagramState[]>([]);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const canvasWrapRef = React.useRef<HTMLDivElement | null>(null);
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);
  const toolbarDragOffsetRef = React.useRef<{ x: number; y: number } | null>(null);
  const toolbarDragStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const toolbarDragMovedRef = React.useRef(false);
  const dragStartRef = React.useRef<DiagramState | null>(null);
  const marqueeSeedRef = React.useRef<string[]>([]);
  
  // Drawing State
  const [drawingPath, setDrawingPath] = React.useState<null | { 
    id: string; 
    points: Array<{ x: number; y: number }>;
    pathType: PathType;
    lineStyle: LineStyle;
    width: number;
  }>(null);
  
  // Placing State (for click-to-place)
  const [placingType, setPlacingType] = React.useState<NodeType | null>(null);
  
  // Radial Menu State
  const [radialMenu, setRadialMenu] = React.useState<{ x: number; y: number; svgX: number; svgY: number } | null>(null);

  const [mousePos, setMousePos] = React.useState<{ x: number; y: number }>({ x: VB_WIDTH / 2, y: VB_HEIGHT / 2 });
  const [gridOn, setGridOn] = React.useState(true);
  const [snapSize, setSnapSize] = React.useState<number>(10);
  const [arrowColor, setArrowColor] = React.useState<string>(DEFAULT_COLORS[0].value);
  const [autoAttach, setAutoAttach] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem("ui.playbook.autoAttach");
      if (raw === null) return true;
      return raw === "1" || raw === "true";
    } catch {
      return true;
    }
  });
  const suppressAutoAttach = React.useRef(false);
  const lastChangeSource = React.useRef<'user' | 'external'>('user');
  const saveDebounce = React.useRef<number | null>(null);

  const [batchBall, setBatchBall] = React.useState<number>(0);
  const [batchCone, setBatchCone] = React.useState<number>(0);
  const [batchText, setBatchText] = React.useState<number>(0);
  const [addOpen, setAddOpen] = React.useState<boolean>(false);
  const [focusedNodeId, setFocusedNodeId] = React.useState<string | null>(null);
  const [announceText, setAnnounceText] = React.useState<string>("");
  const [marquee, setMarquee] = React.useState<null | { origin: { x: number; y: number }; current: { x: number; y: number }; additive: boolean }>(null);
  const [quickArrowMode, setQuickArrowMode] = React.useState(false);
  
  // Animation State
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [animProgress, setAnimProgress] = React.useState(0);
  const animReqRef = React.useRef<number | null>(null);

  // Exit Quick Arrow Mode on off-canvas click
  React.useEffect(() => {
    if (!quickArrowMode) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (svgRef.current && !svgRef.current.contains(e.target as Node) && !toolbarRef.current?.contains(e.target as Node)) {
         setQuickArrowMode(false);
         setDrawingPath(null);
         announceToScreenReader("Selection tool activated");
      }
    };
    window.addEventListener("mousedown", handleGlobalClick);
    return () => window.removeEventListener("mousedown", handleGlobalClick);
  }, [quickArrowMode]);

  const remainingBalls = React.useMemo(() => {
    const existing = state.nodes.filter((n) => n.type === "ball").length;
    return Math.max(0, 10 - existing);
  }, [state.nodes]);

  const clampToolbarPosition = React.useCallback((x: number, y: number) => {
    const wrapper = canvasWrapRef.current;
    const toolbar = toolbarRef.current;
    if (!wrapper || !toolbar) return { x, y };
    const bounds = wrapper.getBoundingClientRect();
    const toolbarBounds = toolbar.getBoundingClientRect();
    const margin = 8;
    const maxX = Math.max(margin, bounds.width - toolbarBounds.width - margin);
    const maxY = Math.max(margin, bounds.height - toolbarBounds.height - margin);
    return {
      x: Math.min(Math.max(x, margin), maxX),
      y: Math.min(Math.max(y, margin), maxY),
    };
  }, []);

  React.useLayoutEffect(() => {
    if (toolbarPos || !canvasWrapRef.current || !toolbarRef.current) return;
    const bounds = canvasWrapRef.current.getBoundingClientRect();
    const toolbarBounds = toolbarRef.current.getBoundingClientRect();
    const initialX = (bounds.width - toolbarBounds.width) / 2;
    const initialY = 16;
    setToolbarPos(clampToolbarPosition(initialX, initialY));
  }, [toolbarPos, clampToolbarPosition]);

  React.useLayoutEffect(() => {
    if (!toolbarPos) return;
    const next = clampToolbarPosition(toolbarPos.x, toolbarPos.y);
    if (next.x !== toolbarPos.x || next.y !== toolbarPos.y) {
      setToolbarPos(next);
    }
  }, [toolbarCollapsed, clampToolbarPosition, toolbarPos]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setToolbarPos((prev) => (prev ? clampToolbarPosition(prev.x, prev.y) : prev));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampToolbarPosition]);

  const handleToolbarPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const wrapper = canvasWrapRef.current;
    const toolbar = toolbarRef.current;
    if (!wrapper || !toolbar) return;
    e.preventDefault();
    e.stopPropagation();
    const wrapperBounds = wrapper.getBoundingClientRect();
    const toolbarBounds = toolbar.getBoundingClientRect();
    toolbarDragOffsetRef.current = {
      x: e.clientX - toolbarBounds.left,
      y: e.clientY - toolbarBounds.top,
    };
    toolbarDragStartRef.current = { x: e.clientX, y: e.clientY };
    toolbarDragMovedRef.current = false;
    setToolbarDragging(true);

    const handleMove = (ev: PointerEvent) => {
      const offset = toolbarDragOffsetRef.current;
      const start = toolbarDragStartRef.current;
      if (!offset) return;
      if (start) {
        const dist = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
        if (dist > 3) toolbarDragMovedRef.current = true;
      }
      const nextX = ev.clientX - wrapperBounds.left - offset.x;
      const nextY = ev.clientY - wrapperBounds.top - offset.y;
      setToolbarPos(clampToolbarPosition(nextX, nextY));
    };

    const handleUp = () => {
      setToolbarDragging(false);
      toolbarDragOffsetRef.current = null;
      toolbarDragStartRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  const handleToolbarToggle = () => {
    if (toolbarDragMovedRef.current) {
      toolbarDragMovedRef.current = false;
      return;
    }
    setToolbarCollapsed((prev) => !prev);
    toolbarDragMovedRef.current = false;
  };

  // Animation Loop
  React.useEffect(() => {
    if (!isPlaying) {
      setAnimProgress(0);
      if (animReqRef.current) {
        cancelAnimationFrame(animReqRef.current);
        animReqRef.current = null;
      }
      return;
    }

    let start: number | null = null;
    const DURATION = 2000; // 2s duration
    const PAUSE = 500; // 500ms pause at end

    const animate = (time: number) => {
      if (!start) start = time;
      const elapsed = time - start;
      const totalCycle = DURATION + PAUSE;
      const t = (elapsed % totalCycle) / DURATION;
      
      setAnimProgress(Math.min(1, t));
      animReqRef.current = requestAnimationFrame(animate);
    };

    animReqRef.current = requestAnimationFrame(animate);
    return () => {
      if (animReqRef.current) cancelAnimationFrame(animReqRef.current);
    };
  }, [isPlaying]);

  const getEffectiveColor = React.useCallback(() => {
    if (primaryPath) return primaryPath.color || '#ffffff';
    if (primaryNode) {
        if (primaryNode.color) return primaryNode.color;
        switch (primaryNode.type) {
          case 'coach': return '#ef4444';
          case 'player': return '#2563eb';
          case 'ball': return '#ffd600';
          case 'cone': return '#f97316';
          case 'text': return '#ffffff';
          case 'feeder': return '#a855f7';
          case 'ladder': return '#eab308';
          default: return '#10b981';
        }
    }
    return '#10b981';
  }, [primaryNode, primaryPath]);

  const addMultiple = (type: NodeType, count: number) => {
    if (count <= 0) return;
    if (type === "ball") {
      const existing = state.nodes.filter((n) => n.type === "ball").length;
      const remaining = Math.max(0, 10 - existing);
      const toAdd = Math.min(remaining, count);
      if (toAdd <= 0) return;
      let nodes = [...state.nodes];
      for (let i = 0; i < toAdd; i++) {
        const node: DiagramNode = {
          id: nanoid(),
          type: "ball",
          x: VB_WIDTH / 2,
          y: VB_HEIGHT / 2,
          r: 0,
        };
        nodes = renumberBalls([...nodes, node]);
      }
      commit({ ...state, nodes });
      setSelectedIds([]);
      return;
    }
    // Non-ball nodes
    const additions: DiagramNode[] = [];
    for (let i = 0; i < count; i++) {
      additions.push({ id: nanoid(), type, x: VB_WIDTH / 2, y: VB_HEIGHT / 2, r: 0, label: type === "text" ? "Text" : undefined });
    }
    commit({ ...state, nodes: [...state.nodes, ...additions] });
    setSelectedIds([]);
  };

  const addBatch = (balls: number, cones: number, texts: number) => {
    let nodes = [...state.nodes];
    // Balls (respect max 10)
    const existing = nodes.filter((n) => n.type === "ball").length;
    const remaining = Math.max(0, 10 - existing);
    const toAddBalls = Math.max(0, Math.min(remaining, balls));
    for (let i = 0; i < toAddBalls; i++) {
      nodes.push({ id: nanoid(), type: "ball", x: VB_WIDTH / 2, y: VB_HEIGHT / 2, r: 0 });
    }
    // Cones
    for (let i = 0; i < cones; i++) {
      nodes.push({ id: nanoid(), type: "cone", x: VB_WIDTH / 2, y: VB_HEIGHT / 2, r: 0 });
    }
    // Texts
    for (let i = 0; i < texts; i++) {
      nodes.push({ id: nanoid(), type: "text", x: VB_WIDTH / 2, y: VB_HEIGHT / 2, r: 0, label: "Text" });
    }
    nodes = renumberBalls(nodes);
    commit({ ...state, nodes });
    setSelectedIds([]);
  };

  const snap = React.useCallback(
    (n: number) => (snapSize > 0 ? Math.round(n / snapSize) * snapSize : n),
    [snapSize]
  );

  const pushHistory = (prev: DiagramState) => setHistory((h) => [...h.slice(-49), JSON.parse(JSON.stringify(prev))]);
  const commit = (next: DiagramState) => {
    pushHistory(state);
    setState(next);
    setFuture([]);
  };
  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [state, ...f]);
    setState(prev);
    setSelectedIds([]);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, state]);
    setState(next);
    setSelectedIds([]);
  };

  const toggleOrientation = () => {
    const next = orientation === 'landscape' ? 'portrait' : 'landscape';
    setOrientation(next);
    announceToScreenReader(`Switched to ${next} view`);
    
    // Transpose all elements to fit new rotation (x becomes y, y becomes x)
    // This effectively pivots the diagram around the axis
    const nextNodes = state.nodes.map(n => ({
        ...n,
        x: n.y,
        y: n.x,
    }));
    const nextPaths = state.paths.map(p => ({
        ...p,
        points: p.points.map(pt => ({ x: pt.y, y: pt.x }))
    }));
    commit({ ...state, nodes: nextNodes, paths: nextPaths });
  };

  // Load persisted diagram after mount to prevent hydration mismatches
  React.useEffect(() => {
    if (disablePersistence) return;
    const s = loadState();
    if (s.nodes?.length || s.paths?.length) {
      setState({ nodes: s.nodes, paths: s.paths || [] });
    } else {
      setState({ nodes: [], paths: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose methods via ref
  React.useImperativeHandle(ref, () => ({
    addBall: () => addNode("ball"),
    addCone: () => addNode("cone"),
    addText: () => addNode("text"),
    undo,
    redo,
    clear: resetDiagram,
    exportJSON,
    exportPNG,
  }));

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere when user is typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'a':
        case 'A':
          if (!drawingPath) {
            e.preventDefault();
            setAddOpen(prev => !prev);
            announceToScreenReader("Add menu opened");
          }
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          setGridOn(prev => {
            const next = !prev;
            announceToScreenReader(`Grid ${next ? 'enabled' : 'disabled'}`);
            return next;
          });
          break;
        case '1':
          e.preventDefault();
          setDrawingPath(null);
          setPlacingType(null);
          announceToScreenReader("Selection tool");
          break;
        case '2':
          e.preventDefault();
          startArrow('linear');
          announceToScreenReader("Arrow tool");
          break;
        case '3':
          e.preventDefault();
          startArrow('curve');
          announceToScreenReader("Curve arrow tool");
          break;
        case '4':
          e.preventDefault();
          setDrawingPath(null);
          setPlacingType('player');
          announceToScreenReader("Player tool");
          break;
        case '5':
          e.preventDefault();
          setDrawingPath(null);
          setPlacingType('coach');
          announceToScreenReader("Coach tool");
          break;
        case '6':
          e.preventDefault();
          setDrawingPath(null);
          setPlacingType('ball');
          announceToScreenReader("Ball tool");
          break;
        case '7':
          e.preventDefault();
          setDrawingPath(null);
          setPlacingType('cone');
          announceToScreenReader("Cone tool");
          break;
        case '8':
          e.preventDefault();
          setDrawingPath(null);
          setPlacingType('target');
          announceToScreenReader("Target tool");
          break;
        case 'Escape':
          if (drawingPath) {
            e.preventDefault();
            setDrawingPath(null);
            announceToScreenReader("Arrow drawing cancelled");
          } else if (placingType) {
            e.preventDefault();
            setPlacingType(null);
            announceToScreenReader("Placement cancelled");
          } else if (selectedIds.length) {
            e.preventDefault();
            setSelectedIds([]);
            setFocusedNodeId(null);
            announceToScreenReader("Selection cleared");
          } else if (showShortcuts) {
            e.preventDefault();
            setShowShortcuts(false);
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedIds.length && !drawingPath && !placingType) {
            e.preventDefault();
            removeSelected();
            announceToScreenReader("Selected elements deleted");
          }
          break;
        case 'd':
        case 'D':
          if (selectedIds.length && !drawingPath && e.ctrlKey) {
            e.preventDefault();
            duplicateSelected();
            announceToScreenReader("Selected elements duplicated");
          }
          break;
        case 'z':
        case 'Z':
          if (e.ctrlKey && !drawingPath && !placingType) {
            e.preventDefault();
            if (e.shiftKey) {
              redo();
              announceToScreenReader("Redo");
            } else {
              undo();
              announceToScreenReader("Undo");
            }
          }
          break;
        case 'y':
        case 'Y':
          if (e.ctrlKey && !drawingPath && !placingType) {
            e.preventDefault();
            redo();
            announceToScreenReader("Redo");
          }
          break;
        case '?':
        case '/':
           if (e.shiftKey) {
             e.preventDefault();
             setShowShortcuts(true);
           }
           break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, drawingPath, state, showShortcuts, placingType]);

  const persistDebounce = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (disablePersistence) return;
    if (persistDebounce.current) window.clearTimeout(persistDebounce.current);
    persistDebounce.current = window.setTimeout(() => {
      saveState(state);
    }, 350);
    return () => {
      if (persistDebounce.current) window.clearTimeout(persistDebounce.current);
    };
  }, [state, disablePersistence]);

  // Auto-attach to selected drill when enabled (debounced)
  React.useEffect(() => {
    if (!autoAttach) return;
    if (suppressAutoAttach.current) return;
    if (saveDebounce.current) {
      window.clearTimeout(saveDebounce.current);
    }
    saveDebounce.current = window.setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent("playbook:diagram:save-to-selected", { detail: { state } }));
      } catch {}
    }, 250);
  }, [state, autoAttach]);

  // Emit latest state for consumers that need to read it (e.g., New Drill save)
  const pushDebounce = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (pushDebounce.current) window.clearTimeout(pushDebounce.current);
    pushDebounce.current = window.setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent("playbook:diagram:push-state", { 
            detail: { state, source: lastChangeSource.current } 
        }));
        // Reset to user after firing (any subsequent state change assumed to be user unless handler overrides)
        lastChangeSource.current = 'user';
      } catch {}
    }, 60);
    return () => {
      if (pushDebounce.current) window.clearTimeout(pushDebounce.current);
    };
  }, [state]);

  const renumberBalls = (nodes: DiagramNode[]) => {
    const indices = nodes
      .map((n, i) => ({ n, i }))
      .filter((x) => x.n.type === "ball");
    if (indices.length <= 1) {
      indices.forEach(({ i }) => {
        nodes[i] = { ...nodes[i], label: undefined };
      });
      return nodes;
    }
    indices.forEach(({ i }, idx) => {
      nodes[i] = { ...nodes[i], label: String(idx + 1) };
    });
    return nodes;
  };

  const addNodeAt = (type: NodeType, x: number, y: number, select = true) => {
     let label: string | undefined;
     
     if (type === "coach") label = "C";
     else if (type === "player") label = "P";
     else if (type === "cone") label = "Cone";
     else if (type === "text") label = "Text";
     else if (type === "target" || type === "targetBox") {
        // Auto-number targets
        const existingTargets = state.nodes.filter(n => n.type === "target" || n.type === "targetBox").length;
        label = String(existingTargets + 1);
     }

     const node: DiagramNode = {
      id: nanoid(),
      type,
      x: x,
      y: y,
      r: 0,
      label,
      size: type === "targetBox" ? 80 : type === "ladder" ? 120 : undefined,
    };
    if (type === "ball") {
      const ballCount = state.nodes.filter((n) => n.type === "ball").length;
      if (ballCount >= 10) return; // max balls
      const nextNodes = renumberBalls([...state.nodes, node]);
      commit({ ...state, nodes: nextNodes });
      if (select) setSelectedIds([node.id]);
      return;
    }
    commit({ ...state, nodes: [...state.nodes, node] });
    if (select) setSelectedIds([node.id]);
  };

  const addNode = (type: NodeType) => {
    addNodeAt(type, VB_WIDTH / 2, VB_HEIGHT / 2);
  };

  const removeSelected = () => {
    if (!selectedIds.length) return;
    const idSet = new Set(selectedIds);
    // Remove Nodes
    const filteredNodes = state.nodes.filter((n) => !idSet.has(n.id));
    const nextNodes = renumberBalls([...filteredNodes]);
    // Remove Paths
    const filteredPaths = state.paths.filter((p) => !idSet.has(p.id));
    
    commit({ ...state, nodes: nextNodes, paths: filteredPaths });
    setSelectedIds([]);
  };

  const duplicateSelected = () => {
    if (!selectedIds.length) return;
    const idSet = new Set(selectedIds);
    
    const nodesToCopy = state.nodes.filter((n) => idSet.has(n.id));
    const pathsToCopy = state.paths.filter((p) => idSet.has(p.id));
    
    if (!nodesToCopy.length && !pathsToCopy.length) return;
    
    const copiedNodes = nodesToCopy.map((node) => ({
      ...node,
      id: nanoid(),
      x: clamp(node.x + 20, 0, VB_WIDTH),
      y: clamp(node.y + 20, 0, VB_HEIGHT),
    }));
    
    const copiedPaths = pathsToCopy.map((path) => ({
      ...path,
      id: nanoid(),
      points: path.points.map(pt => ({ x: pt.x + 20, y: pt.y + 20 }))
    }));

    const nodes = renumberBalls([...state.nodes, ...copiedNodes]);
    const paths = [...state.paths, ...copiedPaths];
    
    commit({ ...state, nodes, paths });
    setSelectedIds([...copiedNodes.map((n) => n.id), ...copiedPaths.map(p => p.id)]);
  };

  const setRotation = (deg: number) => {
    if (!selectedIds.length) return;
    const idSet = new Set(selectedIds);
    const nodes = state.nodes.map((n) => (idSet.has(n.id) ? { ...n, r: deg } : n));
    commit({ ...state, nodes });
  };

  const setSelectedColor = (color: string) => {
    if (!selectedIds.length) return;
    const idSet = new Set(selectedIds);
    const nodes = state.nodes.map((n) => (idSet.has(n.id) ? { ...n, color } : n));
    const paths = state.paths.map((p) => (idSet.has(p.id) ? { ...p, color } : p));
    commit({ ...state, nodes, paths });
  };

  const setArrowHead = (style: ArrowHeadType) => {
    if (!selectedIds.length) return;
    const idSet = new Set(selectedIds);
    const paths = state.paths.map((p) => (idSet.has(p.id) ? { ...p, arrowHead: style } : p));
    commit({ ...state, paths });
  };

  const setLineStyle = (style: LineStyle) => {
    if (!selectedIds.length) return;
    const idSet = new Set(selectedIds);
    const paths = state.paths.map((p) => (idSet.has(p.id) ? { ...p, lineStyle: style } : p));
    commit({ ...state, paths });
  };

  const reorderNodes = (direction: 'front' | 'back') => {
    if (!selectedIds.length) return;
    const idSet = new Set(selectedIds);
    
    // Split nodes into selected and unselected
    const selectedNodes = state.nodes.filter(n => idSet.has(n.id));
    const unselectedNodes = state.nodes.filter(n => !idSet.has(n.id));
    
    // Recombine based on direction
    const nextNodes = direction === 'front' 
        ? [...unselectedNodes, ...selectedNodes]
        : [...selectedNodes, ...unselectedNodes];
        
    commit({ ...state, nodes: nextNodes });
    announceToScreenReader(direction === 'front' ? "Brought to front" : "Sent to back");
  };

  const setNodeSize = (size: number) => {
    if (!selectedIds.length) return;
    const idSet = new Set(selectedIds);
    const nodes = state.nodes.map((n) => (idSet.has(n.id) ? { ...n, size } : n));
    commit({ ...state, nodes });
  };

  // Unified Start (Mouse Down / Touch Start) for Nodes and Paths
  const onStartElement = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    
    // If placing, cancel dragging logic and treat as placement click on top (or ignore)
    if (placingType) {
        const pt = getSvgPoint(e);
        addNodeAt(placingType, snap(pt.x), snap(pt.y), false);
        // Do NOT clear placingType if it's ball or cone (sticky mode)
        if (placingType !== 'ball' && placingType !== 'cone') {
           setPlacingType(null);
        }
        announceToScreenReader(`${placingType} placed`);
        return;
    }
    
    const pt = getSvgPoint(e);
    let nextSelected = selectedIds;
    const alreadySelected = selectedIds.includes(id);
    
    if (e.shiftKey || e.metaKey) {
      if (!nextSelected.includes(id)) {
        nextSelected = [...nextSelected, id];
      }
    } else {
      nextSelected = [id];
    }
    
    if (!nextSelected.length) {
      nextSelected = [id];
    }
    
    setSelectedIds(nextSelected);
    setFocusedNodeId(null);
    
    // Snapshot state for undo/drag baseline
    dragStartRef.current = JSON.parse(JSON.stringify(state));
    setDragging({ startMouse: pt, hasMoved: false });
    
    const node = state.nodes.find((n) => n.id === id);
    const path = state.paths.find((p) => p.id === id);
    
    if ((node || path) && (!alreadySelected || nextSelected.length !== selectedIds.length)) {
      if (nextSelected.length > 1) {
        announceToScreenReader(`${nextSelected.length} elements selected`);
      } else if (node) {
        announceToScreenReader(`${getNodeAriaLabel(node)} selected`);
      } else if (path) {
        announceToScreenReader(`Path selected`);
      }
    }
  };

  const onMoveSvg = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getSvgPoint(e);
    
    // Optimization: Only update mousePos state if we are actively drawing a path.
    // Otherwise, we trigger a full component re-render on every mouse move which causes lag.
    if (drawingPath) {
      setMousePos(pt);
    }
    
    if (marquee) {
      setMarquee((prev) => (prev ? { ...prev, current: pt } : prev));
    }

    if (draggingHandle) {
      const { pathId, handleIndex } = draggingHandle;
      const nextPaths = state.paths.map(p => {
        if (p.id !== pathId) return p;
        const nextPoints = [...p.points];
        if (nextPoints[handleIndex]) {
           nextPoints[handleIndex] = { x: snap(clamp(pt.x, 0, VB_WIDTH)), y: snap(clamp(pt.y, 0, VB_HEIGHT)) };
        }
        return { ...p, points: nextPoints };
      });
      setState({ ...state, paths: nextPaths });
      return;
    }
    
    // Handle Dragging Nodes and Paths via Translation Delta
    if (dragging && dragStartRef.current) {
      const dx = pt.x - dragging.startMouse.x;
      const dy = pt.y - dragging.startMouse.y;
      const idSet = new Set(selectedIds);
      const initial = dragStartRef.current;

      const nextNodes = initial.nodes.map((n) => {
        if (!idSet.has(n.id)) return n;
        return { 
          ...n, 
          x: snap(clamp(n.x + dx, 0, VB_WIDTH)), 
          y: snap(clamp(n.y + dy, 0, VB_HEIGHT)) 
        };
      });
      
      const nextPaths = initial.paths.map((p) => {
        if (!idSet.has(p.id)) return p;
        return {
          ...p,
          points: p.points.map(point => ({
             x: snap(point.x + dx),
             y: snap(point.y + dy)
          }))
        };
      });

      setState({ nodes: nextNodes, paths: nextPaths });
      setDragging((d) => ({ ...d!, hasMoved: true }));
    }
  };

  const onEndSvg = () => {
    if (draggingHandle) {
      setDraggingHandle(null);
      pushHistory(state); // Save state after handle drag
      return;
    }

    const activeDrag = dragging;
    if (activeDrag) {
      setDragging(null);
      if (activeDrag.hasMoved && dragStartRef.current) {
        pushHistory(dragStartRef.current);
      }
      if (activeDrag.hasMoved) {
        setFuture([]);
        if (activeDrag.hasMoved) {
          announceToScreenReader(
             selectedIds.length === 1 ? "Element moved" : `${selectedIds.length} elements moved`
          );
        }
      }
      dragStartRef.current = null;
    }
    
    if (marquee) {
      const { origin, current } = marquee;
      const minX = Math.min(origin.x, current.x);
      const maxX = Math.max(origin.x, current.x);
      const minY = Math.min(origin.y, current.y);
      const maxY = Math.max(origin.y, current.y);
      
      const selectedNodes = state.nodes
        .filter((n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
        .map((n) => n.id);
        
      // Simple bounding box check for path points (if any point is in box, select it)
      const selectedPaths = state.paths
        .filter(p => p.points.some(pt => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY))
        .map(p => p.id);
        
      setMarquee(null);
      const baseSelection = marquee.additive ? marqueeSeedRef.current : [];
      const combined = marquee.additive
        ? Array.from(new Set([...baseSelection, ...selectedNodes, ...selectedPaths]))
        : [...selectedNodes, ...selectedPaths];
      marqueeSeedRef.current = [];
      if (combined.length) {
        setSelectedIds(combined);
        setFocusedNodeId(null);
        announceToScreenReader(
          `${combined.length} element${combined.length === 1 ? "" : "s"} selected`
        );
      } else {
        setSelectedIds([]);
        setFocusedNodeId(null);
        announceToScreenReader("Selection cleared");
      }
    }
  };

  const onStartSvg = (e: React.MouseEvent | React.TouchEvent) => {
      // Check button only for mouse events
      if ('button' in e && e.button !== 0 && !drawingPath && !placingType) return;

      if (drawingPath) {
        const pt = getSvgPoint(e);
        const isCurve = drawingPath.pathType === 'curve';
        
        if (quickArrowMode && drawingPath.pathType === 'linear') {
            // Quick Arrow Mode (2-click)
            const pts = [...drawingPath.points, { x: snap(pt.x), y: snap(pt.y) }];
            commit({ ...state, paths: [...state.paths, { id: drawingPath.id, points: pts, color: arrowColor, pathType: 'linear', lineStyle: 'solid', width: 3 }] });
            setDrawingPath({ id: nanoid(), points: [], pathType: 'linear', lineStyle: 'solid', width: 3 });
            announceToScreenReader("Arrow created. Click to start next.");
            return;
        }
        
        if (isCurve) {
           const currentPts = drawingPath.points;
           if (currentPts.length === 0) {
             // Add Start
             setDrawingPath(prev => prev ? ({ ...prev, points: [{ x: snap(pt.x), y: snap(pt.y) }] }) : null);
             announceToScreenReader("Start point set. Click to set end point.");
           } else if (currentPts.length === 1) {
             // Add End
             setDrawingPath(prev => prev ? ({ ...prev, points: [...prev.points, { x: snap(pt.x), y: snap(pt.y) }] }) : null);
             announceToScreenReader("End point set. Move mouse to adjust curve, click to set.");
           } else if (currentPts.length === 2) {
             // Add Control and Finalize
             const start = currentPts[0];
             const end = currentPts[1];
             const control = { x: snap(pt.x), y: snap(pt.y) };
             
             commit({ 
               ...state, 
               paths: [...state.paths, { 
                 id: drawingPath.id, 
                 points: [start, control, end], // Stored as Start, Control, End
                 color: arrowColor, 
                 pathType: 'curve',
                 arrowHead: 'filled',
                 lineStyle: drawingPath.lineStyle,
                 width: drawingPath.width
               }] 
             });
             // Restart Tool
             setDrawingPath({ id: nanoid(), points: [], pathType: 'curve', lineStyle: drawingPath.lineStyle, width: drawingPath.width });
             announceToScreenReader("Curve arrow created. Click to start next.");
           }
           return;
        }
        
        // Linear Logic (Polyline)
        setDrawingPath((prev) => (prev ? { ...prev, points: [...prev.points, { x: snap(pt.x), y: snap(pt.y) }] } : prev));
        return;
      }
      
      // Handle Start of Quick Arrow
      if (quickArrowMode) {
         const pt = getSvgPoint(e);
         setDrawingPath({ id: nanoid(), points: [{ x: snap(pt.x), y: snap(pt.y) }], pathType: 'linear', lineStyle: 'solid', width: 3 });
         announceToScreenReader("Arrow start. Click to finish.");
         return;
      }

      // Placement Logic
      if (placingType) {
         const pt = getSvgPoint(e);
         // Don't auto-select to avoid tooltip popup
         addNodeAt(placingType, snap(pt.x), snap(pt.y), false);
         
         // Sticky behavior for ball/cone: only clear if NOT ball or cone
         if (placingType !== 'ball' && placingType !== 'cone') {
            setPlacingType(null);
         }
         announceToScreenReader(`${placingType} placed`);
         return;
      }

      const pt = getSvgPoint(e);
      setFocusedNodeId(null);
      marqueeSeedRef.current = [...selectedIds];
      if (!e.shiftKey && !e.metaKey) {
        setSelectedIds([]);
      }
      setMarquee({ origin: pt, current: pt, additive: e.shiftKey || e.metaKey });
  };

  // Keyboard navigation
  const onKeyDownSvg = (e: React.KeyboardEvent) => {
    const activeIds = focusedNodeId ? [focusedNodeId] : selectedIds;
    if (!activeIds.length) return;

    const moveStep = snapSize > 0 ? snapSize : 5;
    let dx = 0;
    let dy = 0;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      dy = -moveStep;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      dy = moveStep;
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      dx = -moveStep;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      dx = moveStep;
    }

    if (dx !== 0 || dy !== 0) {
      const idSet = new Set(activeIds);
      
      // Calculate new state immediately based on current state (no dragStartRef needed here)
      const nextNodes = state.nodes.map(n => {
        if (!idSet.has(n.id)) return n;
        return { ...n, x: snap(clamp(n.x + dx, 0, VB_WIDTH)), y: snap(clamp(n.y + dy, 0, VB_HEIGHT)) };
      });
      
      const nextPaths = state.paths.map(p => {
        if (!idSet.has(p.id)) return p;
        return { ...p, points: p.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) };
      });
      
      pushHistory(state);
      setState({ nodes: nextNodes, paths: nextPaths });
      setFuture([]);
      
      announceToScreenReader("Selection moved");
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        // FORCE RESET ALL TOOLS
        setDrawingPath(null);
        setPlacingType(null);
        setQuickArrowMode(false);
        
        // Handle selection clearing only if no tool was active
        if (!drawingPath && !placingType && !quickArrowMode) {
           if (selectedIds.length) {
              setSelectedIds([]);
              setFocusedNodeId(null);
              announceToScreenReader("Selection cleared");
           } else if (showShortcuts) {
              setShowShortcuts(false);
           }
        } else {
           announceToScreenReader("Selection tool");
        }
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedNodeId && !selectedIds.includes(focusedNodeId)) {
          setSelectedIds([focusedNodeId]);
          const node = state.nodes.find((n) => n.id === focusedNodeId);
          if (node) announceToScreenReader(`${getNodeAriaLabel(node)} selected`);
        }
        return;
      case "Tab":
        e.preventDefault();
        navigateToAdjacentNode(e.shiftKey ? -1 : 1);
        return;
      default:
        return;
    }
  };

  const navigateToAdjacentNode = (direction: number) => {
    const focusableNodes = state.nodes.filter(n => n.type !== "targetLine");
    if (focusableNodes.length === 0) return;

    const currentIndex = focusedNodeId
      ? focusableNodes.findIndex(n => n.id === focusedNodeId)
      : focusableNodes.findIndex(n => n.id === primarySelectedId);

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = focusableNodes.length - 1;
    if (nextIndex >= focusableNodes.length) nextIndex = 0;

    setFocusedNodeId(focusableNodes[nextIndex].id);
    announceToScreenReader(`Focused on ${getNodeAriaLabel(focusableNodes[nextIndex])}`);
  };

  const getNodeAriaLabel = (node: DiagramNode): string => {
    const typeLabels = {
      coach: "Coach",
      player: "Player",
      target: "Target crosshair",
      targetBox: "Target box",
      targetLine: "Target line",
      ball: `Ball ${node.label || ""}`,
      text: `Text: ${node.label || "empty"}`,
      cone: "Cone",
      feeder: "Feeder",
      ladder: "Ladder"
    };

    const baseLabel = typeLabels[node.type] || node.type;
    const position = `at position ${Math.round(node.x)}, ${Math.round(node.y)}`;
    const rotation = node.r ? `, rotated ${node.r} degrees` : "";
    const color = node.color ? `, color ${node.color}` : "";

    return `${baseLabel} ${position}${rotation}${color}`;
  };

  const announceToScreenReader = (text: string) => {
    setAnnounceText(text);
    // Clear after a short delay to allow for repeated announcements
    setTimeout(() => setAnnounceText(""), 1000);
  };

  const getSvgPoint = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const svg = svgRef.current!;
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

  const startArrow = (type: PathType = 'linear') => {
    // Defaults: Linear = Dotted (Polyline), Curve = Dashed & Thinner
    const lineStyle: LineStyle = type === 'linear' ? 'dotted' : 'dashed';
    const width = type === 'curve' ? 1.5 : 3;
    
    setDrawingPath({ id: nanoid(), points: [], pathType: type, lineStyle, width });
    setPlacingType(null); // Clear placement mode
    if (type === 'curve') {
      announceToScreenReader("Click start, end, then adjust curve");
    } else {
      announceToScreenReader("Click to place points");
    }
  };

  const finishArrow = () => {
    if (drawingPath) {
      let pts = drawingPath.points;
      if (drawingPath.pathType === 'linear') {
        if (pts.length === 1) {
          pts = [...pts, { x: snap(mousePos.x), y: snap(mousePos.y) }];
        }
        if (pts.length >= 2) {
          commit({ ...state, paths: [...state.paths, { 
             id: drawingPath.id, 
             points: pts, 
             color: arrowColor, 
             pathType: 'linear',
             lineStyle: drawingPath.lineStyle,
             width: drawingPath.width 
          }] });
          
          // Restart Tool
          setDrawingPath({ id: nanoid(), points: [], pathType: 'linear', lineStyle: drawingPath.lineStyle, width: drawingPath.width });
          announceToScreenReader("Arrow created. Click to start next.");
          return;
        }
      }
    }
    setDrawingPath(null);
  };

  const cancelArrow = () => setDrawingPath(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram-v2.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPNG = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = VB_WIDTH;
    canvas.height = VB_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Fill background for PNG
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, VB_WIDTH, VB_HEIGHT);
    
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url2 = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url2;
      a.download = "diagram-v2.png";
      a.click();
      URL.revokeObjectURL(url2);
    });
  };

  const copyToClipboard = async () => {
      const svg = svgRef.current;
      if (!svg) return;
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const img = new Image();
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = VB_WIDTH;
      canvas.height = VB_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      // Fill background 
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, VB_WIDTH, VB_HEIGHT);
      
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
              await navigator.clipboard.write([
                  new ClipboardItem({ "image/png": blob })
              ]);
              announceToScreenReader("Image copied to clipboard");
          } catch (err) {
              console.error("Failed to copy", err);
          }
          URL.revokeObjectURL(url);
      });
  };

  const resetDiagram = () => {
    commit({ nodes: [], paths: [] });
    setSelectedIds([]);
  };

  const drawCourt = () => {
    const M_LEN = 23.77;
    const M_W_DOUBLES = 10.97;
    const M_W_SINGLES = 8.23;
    const M_SERVICE_FROM_NET = 6.40;

    const pad = COURT_PAD;
    
    // Surface Colors
    const surfaceColors: Record<CourtSurface, string> = {
        blueprint: 'transparent',
        hard: '#3b82f6', // Blue-500
        clay: '#ea580c', // Orange-600
        grass: '#15803d', // Green-700
        elite: '#e260d7' // Elite Court
    };
    
    const surfaceFill = surfaceColors[courtSurface];
    const surfaceOpacity = courtSurface === 'blueprint' ? 0 : 0.25;

    if (orientation === 'landscape') {
        const lengthPx = VB_WIDTH - pad * 2;
        const widthPxDbl = (M_W_DOUBLES / M_LEN) * lengthPx;

        const centerX = VB_WIDTH / 2;
        const centerY = VB_HEIGHT / 2;
        
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
          <g style={{ stroke: 'currentColor' }} strokeOpacity={0.5} strokeWidth={2} fill="none">
            {/* Court Surface Fill */}
            {courtSurface !== 'blueprint' && (
                <rect 
                    x={leftBaseX} 
                    y={topSideY} 
                    width={lengthPx} 
                    height={widthPxDbl} 
                    fill={surfaceFill} 
                    fillOpacity={surfaceOpacity} 
                    stroke="none"
                />
            )}
            
            <rect x={leftBaseX} y={topSideY} width={lengthPx} height={widthPxDbl} />
            <line x1={centerX} y1={topSideY - 10} x2={centerX} y2={bottomSideY + 10} strokeWidth={3} />
            <line x1={leftBaseX} y1={topSideY} x2={leftBaseX} y2={bottomSideY} strokeWidth={4} />
            <line x1={rightBaseX} y1={topSideY} x2={rightBaseX} y2={bottomSideY} strokeWidth={4} />
            <line x1={leftBaseX} y1={centerY} x2={leftBaseX + 8} y2={centerY} />
            <line x1={rightBaseX - 8} y1={centerY} x2={rightBaseX} y2={centerY} />
            <line x1={leftServiceX} y1={topSingleY} x2={leftServiceX} y2={bottomSingleY} />
            <line x1={rightServiceX} y1={topSingleY} x2={rightServiceX} y2={bottomSingleY} />
            <line x1={leftServiceX} y1={centerY} x2={rightServiceX} y2={centerY} />
            <line x1={leftBaseX} y1={topSingleY} x2={rightBaseX} y2={topSingleY} />
            <line x1={leftBaseX} y1={bottomSingleY} x2={rightBaseX} y2={bottomSingleY} />
          </g>
        );
    } else {
        // Portrait
        const lengthPx = VB_HEIGHT - pad * 2;
        const widthPxDbl = (M_W_DOUBLES / M_LEN) * lengthPx;

        const centerX = VB_WIDTH / 2;
        const centerY = VB_HEIGHT / 2;

        const topBaseY = centerY - lengthPx / 2;
        const bottomBaseY = centerY + lengthPx / 2;

        const leftSideX = centerX - widthPxDbl / 2;
        const rightSideX = centerX + widthPxDbl / 2;

        const serviceOffsetPx = (M_SERVICE_FROM_NET / M_LEN) * lengthPx;
        const topServiceY = centerY - serviceOffsetPx;
        const bottomServiceY = centerY + serviceOffsetPx;

        const singlesWidthPx = (M_W_SINGLES / M_LEN) * lengthPx;
        const leftSingleX = centerX - singlesWidthPx / 2;
        const rightSingleX = centerX + singlesWidthPx / 2;

        return (
          <g style={{ stroke: 'currentColor' }} strokeOpacity={0.5} strokeWidth={2} fill="none">
             {/* Court Surface Fill */}
             {courtSurface !== 'blueprint' && (
                <rect 
                    x={leftSideX} 
                    y={topBaseY} 
                    width={widthPxDbl} 
                    height={lengthPx} 
                    fill={surfaceFill} 
                    fillOpacity={surfaceOpacity} 
                    stroke="none"
                />
            )}
            <rect x={leftSideX} y={topBaseY} width={widthPxDbl} height={lengthPx} />
            <line x1={leftSideX - 10} y1={centerY} x2={rightSideX + 10} y2={centerY} strokeWidth={3} />
            <line x1={leftSideX} y1={topBaseY} x2={rightSideX} y2={topBaseY} strokeWidth={4} />
            <line x1={leftSideX} y1={bottomBaseY} x2={rightSideX} y2={bottomBaseY} strokeWidth={4} />
            <line x1={centerX} y1={topBaseY} x2={centerX} y2={topBaseY + 8} />
            <line x1={centerX} y1={bottomBaseY - 8} x2={centerX} y2={bottomBaseY} />
            <line x1={leftSingleX} y1={topServiceY} x2={rightSingleX} y2={topServiceY} />
            <line x1={leftSingleX} y1={bottomServiceY} x2={rightSingleX} y2={bottomServiceY} />
            <line x1={centerX} y1={topServiceY} x2={centerX} y2={bottomServiceY} />
            <line x1={leftSingleX} y1={topBaseY} x2={leftSingleX} y2={bottomBaseY} />
            <line x1={rightSingleX} y1={topBaseY} x2={rightSingleX} y2={bottomBaseY} />
          </g>
        );
    }
  };

  // Court metrics helper
  const getCourtMetrics = React.useCallback(() => {
    const pad = COURT_PAD;
    const M_LEN = 23.77;
    const M_W_DOUBLES = 10.97;
    
    const centerX = VB_WIDTH / 2;
    const centerY = VB_HEIGHT / 2;

    if (orientation === 'landscape') {
        const lengthPx = VB_WIDTH - pad * 2;
        const widthPxDbl = (M_W_DOUBLES / M_LEN) * lengthPx;
        return { 
            centerX, centerY, 
            leftBaseX: centerX - lengthPx / 2, 
            rightBaseX: centerX + lengthPx / 2, 
            topSideY: centerY - widthPxDbl / 2, 
            bottomSideY: centerY + widthPxDbl / 2 
        };
    } else {
        const lengthPx = VB_HEIGHT - pad * 2;
        const widthPxDbl = (M_W_DOUBLES / M_LEN) * lengthPx;
        return {
            centerX, centerY,
            topBaseY: centerY - lengthPx / 2,
            bottomBaseY: centerY + lengthPx / 2,
            leftSideX: centerX - widthPxDbl / 2,
            rightSideX: centerX + widthPxDbl / 2
        };
    }
  }, [orientation, VB_WIDTH, VB_HEIGHT]);

  // Apply template -> update diagram layout
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { template?: DrillTemplate };
      const t = detail?.template;
      if (!t || !t.diagram) return;
      
      setIsPlaying(false);
      setAnimProgress(0);
      lastChangeSource.current = 'external';
      commit({ nodes: t.diagram.nodes, paths: t.diagram.paths });
      setSelectedIds([]);
      // announceToScreenReader(`Template ${t.name} applied`);
    };
    window.addEventListener("playbook:diagram:apply-template", handler);
    return () => {
      window.removeEventListener("playbook:diagram:apply-template", handler);
    };
  }, [arrowColor, getCourtMetrics]);

  // Clear diagram when requested
  React.useEffect(() => {
    const clearHandler = () => {
      commit({ nodes: [], paths: [] });
      setSelectedIds([]);
    };
    window.addEventListener("playbook:diagram:clear", clearHandler);
    return () => {
      window.removeEventListener("playbook:diagram:clear", clearHandler);
    };
  }, []);

  // Suppress next autosave if asked externally
  React.useEffect(() => {
    const handler = () => {
      suppressAutoAttach.current = true;
      setTimeout(() => { suppressAutoAttach.current = false; }, 500);
    };
    window.addEventListener("playbook:diagram:suppress-next-autosave", handler);
    return () => {
      window.removeEventListener("playbook:diagram:suppress-next-autosave", handler);
    };
  }, []);

  const renderGrid = (step = 20) => {
    const lines: React.ReactNode[] = [];
    for (let x = 0; x <= VB_WIDTH; x += step) {
      lines.push(
        <line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={VB_HEIGHT} stroke="currentColor" strokeOpacity={0.05} strokeWidth={1} />
      );
    }
    for (let y = 0; y <= VB_HEIGHT; y += step) {
      lines.push(
        <line key={`gy-${y}`} x1={0} y1={y} x2={VB_WIDTH} y2={y} stroke="currentColor" strokeOpacity={0.05} strokeWidth={1} />
      );
    }
    return <g role="img" aria-label={`Grid overlay with ${step}px spacing`}>{lines}</g>;
  };

  // Apply a single drill preview -> update diagram layout
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { drill?: Drill };
      const d = detail?.drill;
      
      // Stop animation on drill switch
      setIsPlaying(false);
      setAnimProgress(0);

      if (!d) return;

      if (d.diagram && Array.isArray(d.diagram.nodes) && Array.isArray(d.diagram.paths)) {
        suppressAutoAttach.current = true;
        lastChangeSource.current = 'external';
        commit({ nodes: d.diagram.nodes as any, paths: d.diagram.paths as any });
        setSelectedIds([]);
        setTimeout(() => { suppressAutoAttach.current = false; }, 0);
        return;
      }
      
      // If drill has no diagram (new/empty), clear the canvas
      // But only if we are explicitly switching drills (which is implied by this event firing)
      commit({ nodes: [], paths: [] });
      setSelectedIds([]);
    };
    window.addEventListener("playbook:diagram:apply-drill", handler);
    return () => {
      window.removeEventListener("playbook:diagram:apply-drill", handler);
    };
  }, [getCourtMetrics]);

  // Clear diagram when requested
  React.useEffect(() => {
    const clearHandler = () => {
      setIsPlaying(false);
      setAnimProgress(0);
      commit({ nodes: [], paths: [] });
      setSelectedIds([]);
    };
    window.addEventListener("playbook:diagram:clear", clearHandler);
    return () => {
      window.removeEventListener("playbook:diagram:clear", clearHandler);
    };
  }, []);

  if (isBackground) {
    return (
      <div className={cn("relative overflow-hidden w-full h-full", fill && "flex-1")}>
        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full touch-none select-none pointer-events-none"
        >
          <rect x={0} y={0} width={VB_WIDTH} height={VB_HEIGHT} fill="transparent" />
          <g>{drawCourt()}</g>
        </svg>
      </div>
    );
  }

  return (
    <TooltipProvider>
    {/* Shortcuts Help Modal */}
    {showShortcuts && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowShortcuts(false)}>
           <div className="bg-card border border-border p-6 rounded-xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-foreground">Keyboard Shortcuts</h3>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full" onClick={() => setShowShortcuts(false)}>✕</Button>
               </div>
               <div className="space-y-3 text-sm text-foreground">
                  <div className="flex justify-between"><span className="text-muted-foreground">A</span> <span>Add Menu</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">G</span> <span>Toggle Grid</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">1-8</span> <span>Select, Arrow, Curve, Player, Coach, Ball, Cone, Target</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Del / Backspace</span> <span>Delete Selected</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ctrl + D</span> <span>Duplicate</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ctrl + Z</span> <span>Undo</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ctrl + Y</span> <span>Redo</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Arrows</span> <span>Nudge Selection</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">?</span> <span>This Menu</span></div>
               </div>
           </div>
        </div>
    )}

    <Card className={cn("border border-primary/10 bg-background flex flex-col overflow-hidden h-full shadow-[0_0_40px_-10px_hsl(var(--primary)/0.15)] rounded-xl", fill && "flex-1")}>
      {showHeader && (
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 px-4 border-b border-primary/10 bg-card/40 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
           <div className="bg-primary/20 p-1.5 rounded-md text-primary shadow-[0_0_10px_-3px_hsl(var(--primary)/0.3)]">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
           </div>
           <div>
              <CardTitle className="text-sm font-bold text-foreground tracking-wide">Court Diagram</CardTitle>
              <p className="text-[10px] text-muted-foreground font-medium">Drag & Drop Editor</p>
           </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Elements Group - Preserved as accessible menu */}
          <div className="flex items-center gap-1 bg-card/60 p-1 rounded-lg border border-border/50">
              <DropdownMenu open={addOpen} onOpenChange={setAddOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="h-7 px-3 gap-2 bg-secondary text-foreground border-border hover:bg-muted hover:text-foreground hover:border-border transition-all shadow-sm">
                    <span className="text-lg leading-none text-primary pb-0.5">+</span> Add
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card border-border" align="start">
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Objects</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => addNode("coach")}>Coach</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addNode("player")}>Player</DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Targets</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => addNode("target")}>Target Crosshair</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addNode("targetBox")}>Target Box</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addNode("targetLine")}>Target Line</DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Batch Insert</DropdownMenuLabel>
                  {/* Batch controls for Ball */}
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={remainingBalls <= 0}>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span>Ball {remainingBalls <= 0 ? "(max)" : ""}</span>
                      <div className="flex items-center gap-1 bg-secondary rounded p-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBatchBall((c) => Math.max(0, Math.min(c - 1, remainingBalls)));
                          }}
                        >
                          -
                        </Button>
                        <span className="w-4 text-center text-xs font-mono">{batchBall}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBatchBall((c) => Math.max(0, Math.min(remainingBalls, c + 1)));
                          }}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </DropdownMenuItem>
                   {/* Batch controls for Cone */}
                   <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span>Cone</span>
                      <div className="flex items-center gap-1 bg-secondary rounded p-0.5">
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-muted" onClick={(e) => { e.stopPropagation(); setBatchCone(c => Math.max(0, c-1)); }}>-</Button>
                        <span className="w-4 text-center text-xs font-mono">{batchCone}</span>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-muted" onClick={(e) => { e.stopPropagation(); setBatchCone(c => c+1); }}>+</Button>
                      </div>
                    </div>
                  </DropdownMenuItem>
                  {/* Batch controls for Text */}
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span>Text Label</span>
                      <div className="flex items-center gap-1 bg-secondary rounded p-0.5">
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-muted" onClick={(e) => { e.stopPropagation(); setBatchText(c => Math.max(0, c-1)); }}>-</Button>
                        <span className="w-4 text-center text-xs font-mono">{batchText}</span>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-muted" onClick={(e) => { e.stopPropagation(); setBatchText(c => c+1); }}>+</Button>
                      </div>
                    </div>
                  </DropdownMenuItem>
                  <div className="p-2 pt-1 flex justify-end gap-2 mt-1">
                    <Button
                      size="sm"
                      className="w-full h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={(e) => {
                        e.stopPropagation();
                        const toAddBalls = Math.max(0, Math.min(batchBall, remainingBalls));
                        addBatch(toAddBalls, batchCone, batchText);
                        setBatchBall(0);
                        setBatchCone(0);
                        setBatchText(0);
                        setAddOpen(false);
                      }}
                    >
                      Insert Selected
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

          {/* Templates Dropdown */}
          <div className="w-px h-4 bg-muted mx-1"></div>
          
          <DropdownMenu>
             <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                   Templates
                </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent className="w-56 bg-card border-border" align="start">
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Load Template</DropdownMenuLabel>
                {/* Render Passed Templates */}
                {(templates || []).map((t: any) => (
                   <DropdownMenuItem 
                      key={t.id} 
                      onClick={() => {
                          window.dispatchEvent(new CustomEvent("playbook:diagram:apply-template", { detail: { template: t } }));
                      }}
                   >
                      {t.name}
                   </DropdownMenuItem>
                ))}
                {(templates || []).length === 0 && (
                   <div className="px-2 py-1.5 text-xs text-muted-foreground italic">No templates saved.</div>
                )}
                
                <DropdownMenuSeparator className="bg-border" />
                
                <DropdownMenuItem 
                   onClick={() => {
                      const name = prompt("Enter template name:");
                      if (name && onSaveTemplate) {
                         onSaveTemplate(name);
                      }
                   }}
                   className="text-primary focus:text-primary"
                >
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                   Save as Template...
                </DropdownMenuItem>
             </DropdownMenuContent>
          </DropdownMenu>

          {/* Properties */}
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-7 h-7 p-0 border-dashed border-border bg-transparent hover:bg-secondary">
                     <div className="w-3 h-3 rounded-full shadow-sm ring-1 ring-inset ring-black/10" style={{ backgroundColor: arrowColor }}></div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40 bg-card border-border">
                  <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">Default Color</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  {DEFAULT_COLORS.map((c) => (
                    <DropdownMenuItem key={c.value} onClick={() => setArrowColor(c.value)}>
                      <span className="mr-2 inline-block size-3 rounded-full border border-border/50" style={{ backgroundColor: c.value }} />
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>
            <TooltipContent>Arrow Color</TooltipContent>
          </Tooltip>
          </div>

          {/* Drawing actions */}
          {drawingPath ? (
            <div className="flex items-center gap-1 animate-in fade-in zoom-in-95">
              <Button variant="secondary" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={cancelArrow}>Cancel</Button>
            </div>
          ) : null}
          
          {/* Placing actions */}
          {placingType ? (
             <div className="flex items-center gap-1 animate-in fade-in zoom-in-95">
              <div className="h-8 px-3 flex items-center bg-primary/20 text-primary text-xs rounded-md border border-primary/20 font-medium">
                 Click map to place {placingType}
              </div>
              <Button variant="secondary" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={() => setPlacingType(null)}>Cancel</Button>
            </div>
          ) : null}

          <div className="h-6 w-px bg-border mx-1"></div>

          {/* Animation Controls */}
          <div className="flex items-center gap-1 bg-card/60 p-1 rounded-lg border border-border/50">
             <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                   variant={isPlaying ? "destructive" : "ghost"} 
                   size="icon" 
                   className={cn("h-6 w-7 rounded hover:bg-secondary", isPlaying ? "text-red-400 hover:text-red-300 hover:bg-red-900/20" : "text-muted-foreground hover:text-primary")}
                   onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isPlaying ? "Stop" : "Play Action"}</TooltipContent>
            </Tooltip>
          </div>

          <div className="h-6 w-px bg-border mx-1"></div>

          {/* History Group */}
          <div className="flex gap-0.5 bg-card/60 rounded-lg p-1 border border-border/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" onClick={undo} disabled={!history.length}>
                  <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.84998 7.49998C1.84998 4.66458 4.05979 1.84998 7.49998 1.84998C10.2783 1.84998 11.6508 3.66283 12.1373 5.5H9.99998C9.58577 5.5 9.24998 5.83579 9.24998 6.24999C9.24998 6.66419 9.58577 6.99999 9.99998 6.99999H13.25C13.6642 6.99999 14 6.66419 14 6.24999V2.99999C14 2.58578 13.6642 2.24999 13.25 2.24999C12.8358 2.24999 12.5 2.58578 12.5 2.99999V4.51059C11.8833 2.33538 10.1755 0.349976 7.49998 0.349976C3.22463 0.349976 0.349976 3.83942 0.349976 7.49998C0.349976 11.1605 3.22463 14.65 7.49998 14.65C9.6855 14.65 11.6854 13.9497 12.9911 12.8184C13.3067 12.545 13.3329 12.0755 13.0595 11.7599C12.7861 11.4443 12.3167 11.4181 12.0011 11.6915C10.9395 12.6113 9.31373 13.15 7.49998 13.15C4.05979 13.15 1.84998 10.3354 1.84998 7.49998Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" onClick={redo} disabled={!future.length}>
                  <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="scale-x-[-1]"><path d="M1.84998 7.49998C1.84998 4.66458 4.05979 1.84998 7.49998 1.84998C10.2783 1.84998 11.6508 3.66283 12.1373 5.5H9.99998C9.58577 5.5 9.24998 5.83579 9.24998 6.24999C9.24998 6.66419 9.58577 6.99999 9.99998 6.99999H13.25C13.6642 6.99999 14 6.66419 14 6.24999V2.99999C14 2.58578 13.6642 2.24999 13.25 2.24999C12.8358 2.24999 12.5 2.58578 12.5 2.99999V4.51059C11.8833 2.33538 10.1755 0.349976 7.49998 0.349976C3.22463 0.349976 0.349976 3.83942 0.349976 7.49998C0.349976 11.1605 3.22463 14.65 7.49998 14.65C9.6855 14.65 11.6854 13.9497 12.9911 12.8184C13.3067 12.545 13.3329 12.0755 13.0595 11.7599C12.7861 11.4443 12.3167 11.4181 12.0011 11.6915C10.9395 12.6113 9.31373 13.15 7.49998 13.15C4.05979 13.15 1.84998 10.3354 1.84998 7.49998Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </div>

          <div className="h-6 w-px bg-border mx-1"></div>

          {/* View Controls */}
          <div className="flex items-center gap-2">
             {/* Surface Selector */}
             <div className="flex items-center gap-1 bg-card/60 p-0.5 rounded-md border border-border/50">
              <Select
                value={courtSurface}
                onValueChange={(v) => setCourtSurface(v as CourtSurface)}
              >
                <SelectTrigger className="w-[85px] h-7 text-[10px] bg-transparent border-none focus:ring-0 focus:ring-offset-0 px-1 text-muted-foreground font-medium">
                    <SelectValue placeholder="Surface" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blueprint">Blueprint</SelectItem>
                  <SelectItem value="hard">Pro Hard</SelectItem>
                  <SelectItem value="clay">Clay Court</SelectItem>
                  <SelectItem value="grass">Grass Court</SelectItem>
                  <SelectItem value="elite">Elite Court</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary text-muted-foreground hover:text-foreground" onClick={toggleOrientation} aria-label="Toggle Orientation">
                  {orientation === 'landscape' ? (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 1C1.67157 1 1 1.67157 1 2.5V12.5C1 13.3284 1.67157 14 2.5 14H12.5C13.3284 14 14 13.3284 14 12.5V2.5C14 1.67157 13.3284 1 12.5 1H2.5ZM2 2.5C2 2.22386 2.22386 2 2.5 2H12.5C12.7761 2 13 2.22386 13 2.5V12.5C13 12.7761 12.7761 13 12.5 13H2.5C2.22386 13 2 12.7761 2 12.5V2.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 1C1.67157 1 1 1.67157 1 2.5V12.5C1 13.3284 1.67157 14 2.5 14H12.5C13.3284 14 14 13.3284 14 12.5V2.5C14 1.67157 13.3284 1 12.5 1H2.5ZM2 2.5C2 2.22386 2.22386 2 2.5 2H12.5C12.7761 2 13 2.22386 13 2.5V12.5C13 12.7761 12.7761 13 12.5 13H2.5C2.22386 13 2 12.7761 2 12.5V2.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" transform="rotate(90 7.5 7.5)"></path></svg>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Orientation</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant={gridOn ? "secondary" : "ghost"} className={cn("h-8 w-8 text-xs border border-transparent", gridOn && "bg-secondary border-border text-foreground")} onClick={() => setGridOn((v) => !v)}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1.5C1.5 1.22386 1.72386 1 2 1H13C13.2761 1 13.5 1.22386 13.5 1.5V13.5C13.5 13.7761 13.2761 14 13 14H2C1.72386 14 1.5 13.7761 1.5 13.5V1.5ZM2.5 2.5V6.5H6.5V2.5H2.5ZM7.5 2.5V6.5H12.5V2.5H7.5ZM2.5 7.5V12.5H6.5V7.5H2.5ZM7.5 7.5V12.5H12.5V7.5H7.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Grid</TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1 bg-card/60 p-0.5 rounded-md border border-border/50">
              <Select
                value={String(snapSize)}
                onValueChange={(v) => setSnapSize(Number(v))}
              >
                <SelectTrigger className="w-[60px] h-7 text-[10px] bg-transparent border-none focus:ring-0 focus:ring-offset-0 px-1 text-muted-foreground"><SelectValue placeholder="Snap" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={"0"}>No Snap</SelectItem>
                  <SelectItem value={"5"}>5 px</SelectItem>
                  <SelectItem value={"10"}>10 px</SelectItem>
                  <SelectItem value={"20"}>20 px</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
             <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShowShortcuts(true)}>
                  <span className="font-bold text-sm">?</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Shortcuts</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex-1"></div>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 gap-2 ml-1 hover:bg-secondary text-muted-foreground hover:text-foreground">
                <span className="hidden sm:inline text-xs">Export</span>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 11C7.77614 11 8 10.7761 8 10.5V6H9.5C9.62752 6 9.74998 5.95204 9.84379 5.86558C9.9376 5.77912 9.99596 5.66046 10.0076 5.53324C10.0192 5.40602 9.98319 5.27958 9.90657 5.17862L7.90657 2.17862C7.82283 2.06692 7.66795 2 7.5 2C7.33205 2 7.17717 2.06692 7.09343 2.17862L5.09343 5.17862C5.01681 5.27958 4.9808 5.40602 4.9924 5.53324C5.00401 5.66046 5.06237 5.77912 5.15618 5.86558C5.25 5.95204 5.37245 6 5.5 6H7V10.5C7 10.7761 7.22386 11 7.5 11ZM3.5 13C3.22386 13 3 12.7761 3 12.5C3 12.2239 3.22386 12 3.5 12H11.5C11.7761 12 12 12.2239 12 12.5C12 12.7761 11.7761 13 11.5 13H3.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-card border-border">
              <DropdownMenuItem onClick={copyToClipboard} className="gap-2">
                 <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 9.50006C1 10.3285 1.67157 11.0001 2.5 11.0001H4L4 10.0001H2.5C2.22386 10.0001 2 9.7762 2 9.50006L2 2.50006C2 2.22392 2.22386 2.00006 2.5 2.00006L9.5 2.00006C9.77614 2.00006 10 2.22392 10 2.50006V4.00006H11V2.50006C11 1.67163 10.3284 1.00006 9.5 1.00006L2.5 1.00006C1.67157 1.00006 1 1.67163 1 2.50006L1 9.50006ZM5 5.50006C5 4.67163 5.67157 4.00006 6.5 4.00006H12.5C13.3284 4.00006 14 4.67163 14 5.50006V12.5001C14 13.3285 13.3284 14.0001 12.5 14.0001H6.5C5.67157 14.0001 5 13.3285 5 12.5001V5.50006ZM6.5 5.00006H12.5C12.7761 5.00006 13 5.22392 13 5.50006V12.5001C13 12.7762 12.7761 13.0001 12.5 13.0001H6.5C6.22386 13.0001 6 12.7762 6 12.5001V5.50006C6 5.22392 6.22386 5.00006 6.5 5.00006Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                 Copy to Clipboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPNG} className="gap-2">
                 Save as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportJSON} className="gap-2">
                 Save as JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={resetDiagram} className="text-destructive focus:text-destructive hover:bg-destructive/10">
                Clear Canvas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      )}
      
      <CardContent ref={canvasWrapRef} className={cn("relative p-0 overflow-hidden bg-background", fill && "flex-1")}>
          {/* Quick Access Toolbar (Draggable + Collapsible) */}
          <div
            ref={toolbarRef}
            className={cn(
              "absolute z-20 flex items-center gap-1 p-1 bg-card border border-border rounded-lg shadow-xl animate-in fade-in slide-in-from-top-4",
              toolbarDragging && "cursor-grabbing"
            )}
            style={{
              left: toolbarPos ? `${toolbarPos.x}px` : "50%",
              top: toolbarPos ? `${toolbarPos.y}px` : "16px",
              transform: toolbarPos ? undefined : "translateX(-50%)",
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              onPointerDown={handleToolbarPointerDown}
              onClick={handleToolbarToggle}
              title={toolbarCollapsed ? "Expand tools" : "Collapse tools"}
              aria-label={toolbarCollapsed ? "Expand tools" : "Collapse tools"}
              className={cn(
                "h-8 w-8 rounded-md border border-border/60 bg-secondary/50 hover:bg-secondary touch-none ring-1 ring-primary/20 shadow-sm",
                toolbarCollapsed ? "text-foreground" : "text-primary",
                toolbarDragging ? "cursor-grabbing" : "cursor-grab"
              )}
            >
              <img src="/vgta-icon.svg" alt="VGTA" className="h-4 w-4" draggable="false" />
            </Button>

            {!toolbarCollapsed && (
              <>
                <div className="w-px h-6 bg-border mx-0.5" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={!drawingPath && !placingType && !quickArrowMode ? "secondary" : "ghost"}
                      size="icon"
                      className={cn("h-8 w-8 rounded", !drawingPath && !placingType && !quickArrowMode && "bg-primary/20 text-primary hover:bg-primary/30")}
                      onClick={() => { setDrawingPath(null); setPlacingType(null); setQuickArrowMode(false); }}
                      aria-label="Select tool"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Select</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-0.5" />

                 <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={quickArrowMode ? "secondary" : "ghost"}
                      size="icon"
                      className={cn("h-7 w-7 rounded hover:bg-secondary", quickArrowMode && "bg-primary/20 text-primary")}
                      onClick={() => { setDrawingPath(null); setPlacingType(null); setQuickArrowMode(true); }}
                      aria-label="Quick Arrow (2-Click)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Quick Arrow (2-Click)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={drawingPath?.pathType === 'linear' && !quickArrowMode ? "secondary" : "ghost"}
                      size="icon"
                      className={cn("h-7 w-7 rounded hover:bg-secondary", drawingPath?.pathType === 'linear' && !quickArrowMode && "bg-primary/20 text-primary")}
                      onClick={() => { startArrow('linear'); setQuickArrowMode(false); }}
                      aria-label="Polyline Arrow"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Polyline Arrow</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={drawingPath?.pathType === 'curve' ? "secondary" : "ghost"}
                      size="icon"
                      className={cn("h-7 w-7 rounded hover:bg-secondary", drawingPath?.pathType === 'curve' && "bg-primary/20 text-primary")}
                      onClick={() => startArrow('curve')}
                      aria-label="Curve arrow tool"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8"/><polyline points="16 8 20 12 16 16"/></svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Curve Arrow</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-0.5" />

                <Tooltip>
                  <TooltipTrigger asChild>
                  <Button variant={placingType === 'player' ? 'secondary' : 'ghost'} size="icon" className={cn("h-7 w-7 rounded hover:bg-secondary hover:text-blue-400 text-blue-500", placingType === 'player' && "bg-blue-500/20")} onClick={() => setPlacingType('player')} aria-label="Player tool">
                    <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[9px] font-bold">P</div>
                  </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Player</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                  <Button variant={placingType === 'coach' ? 'secondary' : 'ghost'} size="icon" className={cn("h-7 w-7 rounded hover:bg-secondary hover:text-red-400 text-red-500", placingType === 'coach' && "bg-red-500/20")} onClick={() => setPlacingType('coach')} aria-label="Coach tool">
                     <div className="w-4 h-4 rounded-sm border-2 border-current flex items-center justify-center text-[9px] font-bold">C</div>
                  </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Coach</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                  <Button variant={placingType === 'ball' ? 'secondary' : 'ghost'} size="icon" className={cn("h-7 w-7 rounded hover:bg-secondary hover:text-yellow-300 text-yellow-400", placingType === 'ball' && "bg-yellow-500/20")} onClick={() => setPlacingType('ball')} aria-label="Ball tool">
                     <div className="w-3 h-3 rounded-full bg-current"></div>
                  </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Ball</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                  <Button variant={placingType === 'cone' ? 'secondary' : 'ghost'} size="icon" className={cn("h-7 w-7 rounded hover:bg-secondary hover:text-orange-400 text-orange-500", placingType === 'cone' && "bg-orange-500/20")} onClick={() => setPlacingType('cone')} aria-label="Cone tool">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3L2 20h20L12 3z"/></svg>
                  </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Cone</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                  <Button variant={placingType === 'target' ? 'secondary' : 'ghost'} size="icon" className={cn("h-7 w-7 rounded hover:bg-secondary hover:text-green-400 text-green-500", placingType === 'target' && "bg-green-500/20")} onClick={() => setPlacingType('target')} aria-label="Target tool">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Target</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-0.5" />

                <Tooltip>
                  <TooltipTrigger asChild>
                  <Button variant={placingType === 'feeder' ? 'secondary' : 'ghost'} size="icon" className={cn("h-7 w-7 rounded hover:bg-secondary hover:text-purple-400 text-purple-500", placingType === 'feeder' && "bg-purple-500/20")} onClick={() => setPlacingType('feeder')} aria-label="Feeder tool">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
                  </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Feeder</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                  <Button variant={placingType === 'ladder' ? 'secondary' : 'ghost'} size="icon" className={cn("h-7 w-7 rounded hover:bg-secondary hover:text-yellow-500 text-yellow-500", placingType === 'ladder' && "bg-yellow-500/20")} onClick={() => setPlacingType('ladder')} aria-label="Ladder tool">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8"/></svg>
                  </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Ladder</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          {/* Dynamic Floating Selection Toolbar */}
          {selectedIds.length > 0 && selectionBounds && (
            <div 
              className={cn(
                "absolute z-30 flex items-center gap-3 p-2.5 rounded-full border border-primary/20 bg-card/95 shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.25)] backdrop-blur-md animate-in fade-in duration-200 whitespace-nowrap",
                dragging && "pointer-events-none opacity-50"
              )}
              style={{
                left: `clamp(250px, ${(selectionBounds.centerX / VB_WIDTH) * 100}%, calc(100% - 250px))`,
                top: `calc(${(Math.max(120, selectionBounds.minY) / VB_HEIGHT) * 100}% - 80px)`,
                transform: 'translateX(-50%)'
              }}
              onMouseDown={(e) => e.stopPropagation()} 
              onTouchStart={(e) => e.stopPropagation()}
            >
              {/* Label (Single Node Selection Only) */}
              {selectedIds.length === 1 && !primaryPath && (
                <div className="flex items-center pl-3 pr-2 border-r border-border" title="Edit Label">
                  <Input
                    className="h-9 text-sm bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 text-foreground placeholder:text-muted-foreground font-bold"
                    placeholder="Label..."
                    value={primaryNode?.label ?? ""}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      if (!primarySelectedId) return;
                      commit({
                        ...state,
                        nodes: state.nodes.map((n) => (n.id === primarySelectedId ? { ...n, label: newLabel } : n)),
                      });
                    }}
                    maxLength={10}
                    style={{ width: `${Math.max(45, (primaryNode?.label?.length || 0) * 10 + 30)}px` }}
                  />
                </div>
              )}

              {/* Color Picker (Paths Only) */}
              {primaryPath && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 px-3" title="Change Color">
                      <div className="relative flex items-center justify-center w-8 h-8 rounded-full overflow-hidden ring-2 ring-border/40 hover:ring-border/60 transition-all cursor-pointer">
                        <input
                          type="color"
                          className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-none opacity-0 z-10"
                          value={getEffectiveColor()}
                          onChange={(e) => setSelectedColor(e.target.value)}
                        />
                         <div className="absolute inset-0" style={{ backgroundColor: getEffectiveColor() }} />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Color</TooltipContent>
                </Tooltip>
              )}

              {/* Path Controls (Arrow Head & Line Style) */}
              {primaryPath && (
                <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 border-l border-border">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 px-3 text-sm gap-2 hover:bg-secondary text-foreground font-bold">
                            <span>{primaryPath.arrowHead === 'outlined' ? 'Outline' : 'Filled'}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-card border-border">
                           <DropdownMenuItem onClick={() => setArrowHead('filled')}>Filled</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => setArrowHead('outlined')}>Outlined</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Arrow Style</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 border-l border-border">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 px-3 text-sm gap-2 hover:bg-secondary text-foreground capitalize font-bold">
                            <span>{primaryPath.lineStyle || 'solid'}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-card border-border">
                           <DropdownMenuItem onClick={() => setLineStyle('solid')}>Solid</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => setLineStyle('dashed')}>Dashed</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => setLineStyle('dotted')}>Dotted</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Line Style</TooltipContent>
                </Tooltip>
                </>
              )}

              <div className="h-6 w-px bg-muted mx-2" />

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full hover:bg-muted hover:text-foreground text-foreground"
                      onClick={() => {
                        duplicateSelected();
                        announceToScreenReader("Duplicated");
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1C1.22386 1 1 1.22386 1 1.5V10.5C1 10.7761 1.22386 11 1.5 11H4.5C4.77614 11 5 10.7761 5 10.5V10H10.5C10.7761 10 11 9.7761 11 9.5V4.5C11 4.22386 10.7761 4 10.5 4H10V1.5C10 1.22386 9.77614 1 9.5 1H1.5ZM2 2H9V4H4.5C4.22386 4 4 4.22386 4 4.5V9H2V2ZM5 5H10V9H5V5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Duplicate (Ctrl+D)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full hover:bg-red-500/20 hover:text-red-400 text-red-400/80"
                      onClick={() => {
                        removeSelected();
                        announceToScreenReader("Deleted");
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 1C5.22386 1 5 1.22386 5 1.5C5 1.77614 5.22386 2 5.5 2H9.5C9.77614 2 10 1.7761 10 1.5C10 1.22386 9.77614 1 9.5 1H5.5ZM3 3.5C3 3.22386 3.22386 3 3.5 3H5H10H11.5C11.7761 3 12 3.22386 12 3.5C12 3.77614 11.7761 4 11.5 4H11V13C11 13.5523 10.5523 14 10 14H5C4.44772 14 4 13.5523 4 13V4H3.5C3.22386 4 3 3.77614 3 3.5ZM5 4H10V13H5V4Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete (Del)</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Screen reader announcements */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {announceText}
          </div>

          {/* Radial Context Menu */}
          {radialMenu && (
            <RadialMenu
              x={radialMenu.x}
              y={radialMenu.y}
              onClose={() => setRadialMenu(null)}
              onSelect={(type) => {
                addNodeAt(type, radialMenu.svgX, radialMenu.svgY);
                setRadialMenu(null);
                announceToScreenReader(`${type} placed`);
              }}
            />
          )}

          <svg
            ref={svgRef}
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            preserveAspectRatio="xMidYMid meet"
            className={cn(fill ? "w-full h-full" : "w-full h-auto", "touch-none select-none", placingType ? "cursor-crosshair" : "cursor-default")}
            role="application"
            aria-label="Tennis playbook diagram editor"
            tabIndex={0}
            onMouseMove={onMoveSvg}
            onMouseUp={onEndSvg}
            onMouseLeave={onEndSvg}
            onTouchMove={onMoveSvg}
            onTouchEnd={onEndSvg}
            onTouchCancel={onEndSvg}
            onKeyDown={onKeyDownSvg}
            onContextMenu={(e) => {
               if (drawingPath && drawingPath.pathType === 'linear' && !quickArrowMode) {
                  e.preventDefault();
                  e.stopPropagation();
                  finishArrow();
               }
            }}
            onDoubleClick={(e) => {
                if (drawingPath) {
                    if (drawingPath.pathType === 'linear' && !quickArrowMode) {
                        finishArrow();
                    }
                    return;
                }
                const pt = getSvgPoint(e);
                const rect = e.currentTarget.getBoundingClientRect();
                setRadialMenu({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    svgX: pt.x,
                    svgY: pt.y
                });
            }}
            onMouseDown={onStartSvg}
            onTouchStart={onStartSvg}
          >
            {/* background */}
            <rect x={0} y={0} width={VB_WIDTH} height={VB_HEIGHT} fill="hsl(var(--background))" />
            {/* subtle grid */}
            {gridOn ? renderGrid(20) : null}
            <defs>
              <marker id="arrowhead-filled" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
              </marker>
              <marker id="arrowhead-outlined" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                <path d="M0 0 L10 3.5 L0 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </marker>
              <filter id="nodeShadowV2" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.35" />
              </filter>
              <filter id="pathGlow">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="white" floodOpacity="0.4" />
              </filter>
            </defs>
            {/* court */}
            <g>
              {drawCourt()}
            </g>
            {/* existing paths */}
            {state.paths.map((p) => {
              const isSelected = selectedIds.includes(p.id);
              const isCurve = p.pathType === 'curve';
              let pathD = "";
              if (isCurve && p.points.length === 3) {
                 const [s, c, e] = p.points;
                 pathD = `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${e.x} ${e.y}`;
              }
              
              const markerId = p.arrowHead === 'outlined' ? 'url(#arrowhead-outlined)' : 'url(#arrowhead-filled)';
              
              // Dash array logic
              let strokeDasharray: string | undefined;
              if (p.lineStyle === 'dashed') strokeDasharray = "12 8";
              else if (p.lineStyle === 'dotted') strokeDasharray = "3 6";

              return (
                <g key={p.id} onMouseDown={(e) => onStartElement(e, p.id)} onTouchStart={(e) => onStartElement(e, p.id)} style={{ cursor: 'pointer' }}>
                  {/* Invisible Thick Hit-Stroke */}
                  {isCurve ? (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={20}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <polyline
                      fill="none"
                      stroke="transparent"
                      strokeWidth={20}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={p.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                    />
                  )}
                  
                  {/* Visible Path */}
                  {isCurve ? (
                    <path
                       d={pathD}
                       fill="none"
                       stroke={p.color || '#ffffff'}
                       strokeWidth={p.width ?? 3}
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeDasharray={strokeDasharray}
                       markerEnd={markerId}
                       opacity={0.9}
                       style={{ filter: isSelected ? 'url(#pathGlow)' : undefined }}
                    />
                  ) : (
                    <polyline
                      fill="none"
                      stroke={p.color || '#ffffff'}
                      strokeWidth={p.width ?? 3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={strokeDasharray}
                      markerEnd={markerId}
                      points={p.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                      opacity={0.9}
                      style={{ filter: isSelected ? 'url(#pathGlow)' : undefined }}
                    />
                  )}
                  
                  {/* Control Lines for Curve */}
                  {isSelected && isCurve && p.points.length === 3 && (
                     <path 
                        d={`M ${p.points[0].x} ${p.points[0].y} L ${p.points[1].x} ${p.points[1].y} L ${p.points[2].x} ${p.points[2].y}`}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        opacity={0.5}
                        pointerEvents="none"
                     />
                  )}

                  {/* Edit Handles */}
                  {isSelected && p.points.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r={6}
                      fill="#fff"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      style={{ cursor: "grab" }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ pathId: p.id, handleIndex: idx });
                      }}
                      onTouchStart={(e) => {
                         e.stopPropagation();
                         setDraggingHandle({ pathId: p.id, handleIndex: idx });
                      }}
                    />
                  ))}
                </g>
              );
            })}
            
            {/* In-progress path */}
            {drawingPath && drawingPath.points.length > 0 ? (
              drawingPath.pathType === 'curve' ? (
                <g>
                   {/* Preview based on state */}
                   {drawingPath.points.length === 1 && (
                      <line 
                        x1={drawingPath.points[0].x} 
                        y1={drawingPath.points[0].y}
                        x2={mousePos.x}
                        y2={mousePos.y}
                        stroke={arrowColor}
                        strokeWidth={drawingPath.width || 1.5}
                        strokeDasharray={drawingPath.lineStyle === 'dotted' ? "3 6" : "12 8"}
                      />
                   )}
                   {drawingPath.points.length === 2 && (
                      <path 
                        d={`M ${drawingPath.points[0].x} ${drawingPath.points[0].y} Q ${mousePos.x} ${mousePos.y} ${drawingPath.points[1].x} ${drawingPath.points[1].y}`}
                        fill="none"
                        stroke={arrowColor}
                        strokeWidth={drawingPath.width || 1.5}
                        strokeDasharray={drawingPath.lineStyle === 'dotted' ? "3 6" : "12 8"}
                      />
                   )}
                </g>
              ) : (
                <polyline
                  fill="none"
                  stroke="currentColor"
                  style={{ color: arrowColor }}
                  strokeDasharray={drawingPath.lineStyle === 'dotted' ? "3 6" : "12 8"}
                  strokeWidth={drawingPath.width || 3}
                  points={[...drawingPath.points, { x: snap(mousePos.x), y: snap(mousePos.y) }]
                    .map((pt) => `${pt.x},${pt.y}`)
                    .join(" ")}
                />
              )
            ) : null}
            
            {marquee ? (
              <rect
                x={Math.min(marquee.origin.x, marquee.current.x)}
                y={Math.min(marquee.origin.y, marquee.current.y)}
                width={Math.abs(marquee.current.x - marquee.origin.x)}
                height={Math.abs(marquee.current.y - marquee.origin.y)}
                fill="hsl(var(--primary))"
                fillOpacity={0.12}
                stroke="hsl(var(--primary))"
                strokeDasharray="6 6"
                strokeWidth={2}
              />
            ) : null}
            
            {state.nodes
              .filter((n) => n.type === "targetLine")
              .map((n) => {
                const { centerX, leftBaseX, rightBaseX, centerY, topBaseY, bottomBaseY } = getCourtMetrics();
                
                if (orientation === 'landscape') {
                    const towardLeft = n.x < centerX;
                    const x1 = centerX;
                    const x2 = towardLeft ? leftBaseX : rightBaseX;
                    return (
                      <line
                        key={n.id}
                        x1={x1}
                        y1={n.y}
                        x2={x2}
                        y2={n.y}
                        stroke={n.color || '#10b981'}
                        strokeWidth={3}
                        strokeDasharray="6 6"
                        role="button"
                        aria-label={`Target line ${getNodeAriaLabel(n)}`}
                        aria-selected={selectedIds.includes(n.id)}
                        tabIndex={focusedNodeId === n.id ? 0 : -1}
                        onMouseDown={(e) => onStartElement(e, n.id)}
                        onTouchStart={(e) => onStartElement(e, n.id)}
                        onFocus={() => setFocusedNodeId(n.id)}
                        onBlur={() => { if (focusedNodeId === n.id) setFocusedNodeId(null); }}
                        style={{ cursor: "grab" }}
                      >
                         <title>Target Line</title>
                      </line>
                    );
                } else {
                    const towardTop = n.y < centerY;
                    const y1 = centerY;
                    const y2 = towardTop ? topBaseY! : bottomBaseY!;
                    return (
                      <line
                        key={n.id}
                        x1={n.x}
                        y1={y1}
                        x2={n.x}
                        y2={y2}
                        stroke={n.color || '#10b981'}
                        strokeWidth={3}
                        strokeDasharray="6 6"
                        role="button"
                        aria-label={`Target line ${getNodeAriaLabel(n)}`}
                        aria-selected={selectedIds.includes(n.id)}
                        tabIndex={focusedNodeId === n.id ? 0 : -1}
                        onMouseDown={(e) => onStartElement(e, n.id)}
                        onTouchStart={(e) => onStartElement(e, n.id)}
                        onFocus={() => setFocusedNodeId(n.id)}
                        onBlur={() => { if (focusedNodeId === n.id) setFocusedNodeId(null); }}
                        style={{ cursor: "grab" }}
                      >
                         <title>Target Line</title>
                      </line>
                    );
                }
              })}
            
            {/* Animated Nodes Calculation */}
            {(() => {
               // We calculate this inline or memoize it. 
               // Given the structure of the return, it's easier to map state.nodes to a render-ready list.
               const renderNodes = state.nodes.map(n => {
                  if (!isPlaying || animProgress === 0) return n;
                  
                  // Find if this node is at the start of any path
                  // We'll use a threshold of ~40px
                  const attachedPath = state.paths.find(p => {
                      // Restrict linear paths to only move players
                      if (p.pathType === 'linear' && n.type !== 'player') return false;

                      if (p.points.length === 0) return false;
                      const start = p.points[0];
                      const dx = start.x - n.x;
                      const dy = start.y - n.y;
                      return (dx*dx + dy*dy) < 1600; // 40^2
                  });
                  
                  if (attachedPath) {
                      let pos;
                      if (attachedPath.pathType === 'curve' && attachedPath.points.length === 3) {
                          pos = getBezierPoint(animProgress, attachedPath.points[0], attachedPath.points[1], attachedPath.points[2]);
                      } else {
                          pos = getPolylinePoint(animProgress, attachedPath.points);
                      }
                      return { ...n, x: pos.x, y: pos.y };
                  }
                  return n;
               });

               return renderNodes.filter((n) => n.type !== "targetLine").map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y}) rotate(${n.r})`}
                onMouseDown={(e) => onStartElement(e, n.id)}
                onTouchStart={(e) => onStartElement(e, n.id)}
                style={{ cursor: "grab", filter: "url(#nodeShadowV2)" }}
                role="button"
                aria-label={getNodeAriaLabel(n)}
                aria-selected={selectedIds.includes(n.id)}
                tabIndex={focusedNodeId === n.id ? 0 : -1}
                onFocus={() => {
                  setFocusedNodeId(n.id);
                  if (!selectedIds.includes(n.id)) {
                    announceToScreenReader(`Focused on ${getNodeAriaLabel(n)}`);
                  }
                }}
                onBlur={() => {
                  if (focusedNodeId === n.id) {
                    setFocusedNodeId(null);
                  }
                }}
              >
                <title>{getNodeAriaLabel(n)}</title>
                {n.type === "coach" ? (
                  <g>
                    <rect x={-(n.size ?? 26)} y={-(n.size ?? 26)} width={(n.size ?? 26) * 2} height={(n.size ?? 26) * 2} rx={(n.size ?? 26) / 3} fill={n.color || '#ef4444'} stroke="#fff" strokeWidth={3} />
                    <text x={0} y={(n.size ?? 26) * 0.3} textAnchor="middle" fontSize={(n.size ?? 26) * 0.8} fill="#fff">{n.label ?? "C"}</text>
                  </g>
                ) : n.type === "player" ? (
                  <g>
                    <circle r={n.size ?? 26} fill={n.color || '#2563eb'} stroke="#fff" strokeWidth={3} />
                    <text x={0} y={(n.size ?? 26) * 0.3} textAnchor="middle" fontSize={(n.size ?? 26) * 0.8} fill="#fff">{n.label ?? "P"}</text>
                  </g>
                ) : n.type === "ball" ? (
                  <g>
                    <circle r={n.size ?? 12} fill={n.color || "#ffd600"} stroke="#222" strokeWidth={3} />
                    {n.label ? (
                      <text x={0} y={(n.size ?? 12) * 0.4} textAnchor="middle" fontSize={(n.size ?? 12)} fill="#111" stroke="#fff" strokeWidth={0.9} paintOrder="stroke">
                        {n.label}
                      </text>
                    ) : null}
                  </g>
                ) : n.type === "targetBox" ? (
                  <g>
                    <rect
                      x={-(n.size ?? 80) / 2}
                      y={-(n.size ?? 80) / 2}
                      width={n.size ?? 80}
                      height={n.size ?? 80}
                      fill={n.color || '#10b981'}
                      opacity={0.85}
                      stroke="#fff"
                      strokeWidth={3}
                    />
                    {/* Render Number Label if exists */}
                    {n.label && (
                       <text x={0} y={8} textAnchor="middle" fontSize={32} fill="#fff" stroke="none" fontWeight="bold">{n.label}</text>
                    )}
                  </g>
                ) : n.type === "target" ? (
                  <g>
                    <circle r={n.size ?? 26} fill={n.color || '#10b981'} stroke="#fff" strokeWidth={3} />
                    <line x1={-(n.size ?? 26)} y1={0} x2={n.size ?? 26} y2={0} stroke="#fff" strokeWidth={3} />
                    <line x1={0} y1={-(n.size ?? 26)} x2={0} y2={n.size ?? 26} stroke="#fff" strokeWidth={3} />
                    {/* Render Number Label above */}
                    {n.label && (
                       <text x={0} y={-(n.size ?? 26) - 10} textAnchor="middle" fontSize={24} fill="#fff" stroke="none" fontWeight="bold">{n.label}</text>
                    )}
                  </g>
                ) : n.type === "cone" ? (
                  <g>
                    <path transform={`scale(${(n.size ?? 18) / 18})`} d="M 0 -12 L 9 7.5 L -9 7.5 Z" fill={n.color || '#f97316'} stroke="#fff" strokeWidth={3} />
                  </g>
                ) : n.type === "text" ? (
                  <g>
                    <text x={0} y={9} textAnchor="middle" fontSize={n.size ?? 32} fill={n.color || '#ffffff'} stroke="#000" strokeWidth={1.125} paintOrder="stroke">
                      {n.label ?? "Text"}
                    </text>
                  </g>
                ) : n.type === "feeder" ? (
                  <g>
                     <rect x={-20} y={-20} width={40} height={40} rx={8} fill={n.color || '#a855f7'} stroke="#fff" strokeWidth={2} />
                     <circle cx={0} cy={0} r={12} fill="#fff" />
                     <circle cx={0} cy={0} r={6} fill={n.color || '#a855f7'} />
                  </g>
                ) : n.type === "ladder" ? (
                  <g>
                     {/* Horizontal Ladder Representation */}
                     <rect x={-60} y={-15} width={120} height={30} fill="none" stroke={n.color || '#eab308'} strokeWidth={3} />
                     <line x1={-30} y1={-15} x2={-30} y2={15} stroke={n.color || '#eab308'} strokeWidth={2} />
                     <line x1={0} y1={-15} x2={0} y2={15} stroke={n.color || '#eab308'} strokeWidth={2} />
                     <line x1={30} y1={-15} x2={30} y2={15} stroke={n.color || '#eab308'} strokeWidth={2} />
                  </g>
                ) : (
                  // Fallback
                  <circle r={10} fill="gray" />
                )}
                {/* selection ring */}
                {selectedIds.includes(n.id) ? (
                  <circle r={n.type === 'ladder' ? 70 : 36} fill="none" stroke="hsl(var(--primary))" strokeWidth={4.5} aria-hidden="true" />
                ) : null}
                {/* focus ring */}
                {focusedNodeId === n.id && !selectedIds.includes(n.id) ? (
                  <circle r={42} fill="none" stroke="hsl(var(--primary))" strokeWidth={3} strokeDasharray="6 6" aria-hidden="true" />
                ) : null}
              </g>
            ));
            })()}
          </svg>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
});

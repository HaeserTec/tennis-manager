import React from 'react';
import { Drill } from '@/lib/playbook';
import { cn } from '@/lib/utils';

type NodeType =
  | "coach"
  | "player"
  | "target"
  | "targetBox"
  | "targetLine"
  | "ball"
  | "text"
  | "cone";

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

type DiagramPath = {
  id: string;
  points: Array<{ x: number; y: number }>;
  color?: string;
  width?: number;
  pathType?: PathType;
  arrowHead?: ArrowHeadType;
  dashed?: boolean; 
};

interface DrillThumbnailProps {
  drill: Drill;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'print' | 'compact';
}

const BASE_WIDTH = 1320;
const BASE_HEIGHT = 660;
const COURT_PAD = 100;

export function DrillThumbnail({ drill, width, height, className, style, variant = 'default' }: DrillThumbnailProps) {
  const nodes = (drill.diagram?.nodes || []) as DiagramNode[];
  const paths = (drill.diagram?.paths || []) as DiagramPath[];
  const isPrint = variant === 'print';

  const resolveColor = (color?: string, defaultColor: string = 'currentColor') => {
    const c = color || defaultColor;
    if (c.toLowerCase() === '#ffffff' || c.toLowerCase() === '#fff' || c.toLowerCase() === 'white') {
        return 'currentColor';
    }
    return c;
  };

  const drawCourt = () => {
    const M_LEN = 23.77;
    const M_W_DOUBLES = 10.97;
    const M_W_SINGLES = 8.23;
    const M_SERVICE_FROM_NET = 6.40;

    const pad = COURT_PAD;
    const lengthPx = BASE_WIDTH - pad * 2;
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
      <g className={cn("stroke-white", (isPrint || className?.includes("print:stroke-black")) && "stroke-black print:stroke-black")} strokeOpacity={0.95} strokeWidth={2} fill="none">
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
  };

  return (
    <div 
      style={{ width, height, ...style }} 
      className={cn(
        "bg-background rounded overflow-hidden relative border border-border text-foreground",
        (isPrint) && "bg-transparent border-zinc-300 text-black print:bg-transparent print:border-zinc-300 print:text-black",
        className
      )}
    >
      <svg
        viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        <rect x={0} y={0} width={BASE_WIDTH} height={BASE_HEIGHT} className={cn("fill-zinc-950", (isPrint) && "fill-transparent print:fill-transparent")} />
        
        <defs>
            <marker id={`arrowhead-filled-${drill.id}`} markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
            </marker>
            <marker id={`arrowhead-outlined-${drill.id}`} markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <path d="M0 0 L10 3.5 L0 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </marker>
        </defs>

        {/* Court */}
        {drawCourt()}

        {/* Paths */}
        {paths.map((p) => {
            const isCurve = p.pathType === 'curve';
            let pathD = "";
            if (isCurve && p.points.length === 3) {
                const [s, c, e] = p.points;
                pathD = `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${e.x} ${e.y}`;
            } else if (!isCurve && p.points.length >= 2) {
                pathD = `M ${p.points.map(pt => `${pt.x} ${pt.y}`).join(" L ")}`;
            }

            const markerId = p.arrowHead === 'outlined' ? `url(#arrowhead-outlined-${drill.id})` : `url(#arrowhead-filled-${drill.id})`;
            const pColor = resolveColor(p.color);

            return (
            <g key={p.id} style={{ color: pColor }}>
                <path
                d={pathD}
                fill="none"
                stroke="currentColor"
                strokeWidth={5}
                strokeDasharray={p.dashed ? "15,15" : "none"}
                markerEnd={markerId}
                />
            </g>
            );
        })}

        {/* Nodes */}
        {nodes.filter((n) => n.type !== "targetLine").map((n) => (
            <g
            key={n.id}
            transform={`translate(${n.x},${n.y}) rotate(${n.r})`}
            >
            {n.type === "coach" ? (
                <g>
                <rect x={-18} y={-18} width={36} height={36} rx={6} fill={resolveColor(n.color, '#ef4444')} stroke="#fff" strokeWidth={3} className={cn("print:stroke-black", isPrint && "stroke-black")} />
                <text x={0} y={6} textAnchor="middle" fontSize={15} fill="#fff" fontFamily="sans-serif" className={cn("print:fill-white", isPrint && "fill-white")}>{n.label ?? "C"}</text>
                </g>
            ) : n.type === "player" ? (
                <g>
                <circle r={18} fill={resolveColor(n.color, '#2563eb')} stroke="#fff" strokeWidth={3} className={cn("print:stroke-black", isPrint && "stroke-black")} />
                <text x={0} y={6} textAnchor="middle" fontSize={15} fill="#fff" fontFamily="sans-serif" className={cn("print:fill-white", isPrint && "fill-white")}>{n.label ?? "P"}</text>
                </g>
            ) : n.type === "ball" ? (
                <g>
                <circle r={12} fill={resolveColor(n.color, "#ffd600")} stroke="#222" strokeWidth={3} />
                {n.label ? (
                    <text x={0} y={4.5} textAnchor="middle" fontSize={12} fill="#111" stroke="#fff" strokeWidth={0.9} paintOrder="stroke" fontFamily="sans-serif">
                    {n.label}
                    </text>
                ) : null}
                </g>
            ) : n.type === "targetBox" ? (
                <g>
                <rect
                    x={-(n.size ?? 60) / 2}
                    y={-(n.size ?? 60) / 2}
                    width={n.size ?? 60}
                    height={n.size ?? 60}
                    fill={resolveColor(n.color, '#10b981')}
                    opacity={0.85}
                    stroke="#fff"
                    strokeWidth={3}
                    className={cn("print:stroke-black", isPrint && "stroke-black")}
                />
                </g>
            ) : n.type === "cone" ? (
                <g>
                <path d="M 0 -12 L 9 7.5 L -9 7.5 Z" fill={resolveColor(n.color, '#f97316')} stroke="#fff" strokeWidth={3} className={cn("print:stroke-black", isPrint && "stroke-black")} />
                </g>
            ) : n.type === "text" ? (
                <g>
                <text x={0} y={9} textAnchor="middle" fontSize={24} fill={resolveColor(n.color, '#ffffff')} stroke="#000" strokeWidth={1.125} paintOrder="stroke" fontFamily="sans-serif" className={cn("print:stroke-none", isPrint && "stroke-none")}>
                    {n.label ?? "Text"}
                </text>
                </g>
            ) : (
                <g>
                <circle r={18} fill={resolveColor(n.color, '#10b981')} stroke="#fff" strokeWidth={3} className={cn("print:stroke-black", isPrint && "stroke-black")} />
                <line x1={-18} y1={0} x2={18} y2={0} stroke="#fff" strokeWidth={3} className={cn("print:stroke-black", isPrint && "stroke-black")} />
                <line x1={0} y1={-18} x2={0} y2={18} stroke="#fff" strokeWidth={3} className={cn("print:stroke-black", isPrint && "stroke-black")} />
                </g>
            )}
            </g>
        ))}
      </svg>
    </div>
  );
}
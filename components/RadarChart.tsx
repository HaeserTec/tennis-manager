import React from 'react';
import { cn } from '@/lib/utils';
import type { PlayerStats } from '@/lib/playbook';

interface RadarChartProps {
  stats: PlayerStats;
  size?: number;
  showLabels?: boolean;
  className?: string;
}

export function RadarChart({ stats, size = 200, showLabels = true, className }: RadarChartProps) {
  // Config
  const max = 100;
  const categories: (keyof PlayerStats)[] = ['forehand', 'backhand', 'serve', 'volley', 'movement', 'consistency'];
  const labels = ['FH', 'BH', 'SRV', 'VOL', 'MOV', 'CON'];
  const radius = size / 2;
  const center = size / 2;
  const angleSlice = (Math.PI * 2) / categories.length;

  // Helper to get coordinates
  const getPoint = (value: number, index: number, maxVal: number) => {
    const angle = index * angleSlice - Math.PI / 2; // -PI/2 to start at top
    const r = (value / maxVal) * (radius - (showLabels ? 25 : 5)); // padding
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Generate polygon points
  const points = categories.map((cat, i) => {
    const val = stats[cat];
    const { x, y } = getPoint(val, i, max);
    return `${x},${y}`;
  }).join(' ');

  // Generate grid levels (0, 25, 50, 75, 100)
  const levels = [25, 50, 75, 100];

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="overflow-visible">
        {/* Background Grids */}
        {levels.map((level) => {
          const levelPoints = categories.map((_, i) => {
            const { x, y } = getPoint(level, i, max);
            return `${x},${y}`;
          }).join(' ');
          return (
            <polygon
              key={level}
              points={levelPoints}
              fill="transparent"
              stroke="currentColor"
              className="text-muted-foreground"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis Lines */}
        {categories.map((_, i) => {
          const start = getPoint(0, i, max);
          const end = getPoint(100, i, max);
          return (
            <line
              key={i}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="currentColor"
              className="text-muted-foreground"
              strokeWidth="1"
            />
          );
        })}

        {/* Data Polygon */}
        <polygon
          points={points}
          fill="currentColor"
          fillOpacity="0.2"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary"
        />
        
        {/* Data Points */}
        {categories.map((cat, i) => {
            const val = stats[cat];
            const { x, y } = getPoint(val, i, max);
            return (
                <circle 
                    key={i}
                    cx={x}
                    cy={y}
                    r="3"
                    className="text-primary fill-primary"
                />
            )
        })}

        {/* Labels */}
        {showLabels && categories.map((_, i) => {
          // Push labels out a bit further than the 100 mark
          const { x, y } = getPoint(115, i, max);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-bold fill-muted-foreground"
            >
              {labels[i]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

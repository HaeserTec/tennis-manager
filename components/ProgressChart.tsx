import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ProgressChartData, TrendDirection } from '@/lib/analytics';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ProgressChartProps {
  data: ProgressChartData[];
  height?: number;
  showLegend?: boolean;
  className?: string;
}

const METRIC_COLORS: Record<string, string> = {
  tech: '#ef4444',
  consistency: '#f59e0b',
  tactics: '#10b981',
  movement: '#3b82f6',
  coachability: '#8b5cf6',
  total: '#d946ef',
};

const METRIC_LABELS: Record<string, string> = {
  tech: 'Technique',
  consistency: 'Consistency',
  tactics: 'Tactics',
  movement: 'Movement',
  coachability: 'Coachability',
  total: 'Total',
};

export function ProgressChart({ data, height = 200, showLegend = true, className }: ProgressChartProps) {
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxValue = useMemo(() => {
    return Math.max(...data.flatMap(d => [d.tech, d.consistency, d.tactics, d.movement, d.coachability, d.total]), 10);
  }, [data]);

  const chartWidth = 600;
  const chartHeight = height - 60;
  const padding = { left: 50, right: 20, top: 20, bottom: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const points = useMemo(() => {
    const metrics = ['tech', 'consistency', 'tactics', 'movement', 'coachability'];
    return metrics.map(metric => ({
      metric,
      color: METRIC_COLORS[metric],
      label: METRIC_LABELS[metric],
      path: data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * innerWidth;
        const y = padding.top + innerHeight - (d[metric] / maxValue) * innerHeight;
        return { x, y, value: d[metric], date: d.date };
      }),
    }));
  }, [data, maxValue, innerWidth, innerHeight, padding]);

  const generatePath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return path;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${chartWidth} ${height}`}
        className="w-full h-auto"
        onMouseLeave={() => {
          setHoveredMetric(null);
          setHoveredIndex(null);
        }}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <line
            key={tick}
            x1={padding.left}
            y1={padding.top + innerHeight * (1 - tick)}
            x2={chartWidth - padding.right}
            y2={padding.top + innerHeight * (1 - tick)}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeDasharray="4 4"
          />
        ))}

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <text
            key={tick}
            x={padding.left - 10}
            y={padding.top + innerHeight * (1 - tick) + 4}
            textAnchor="end"
            className="text-[10px] fill-muted-foreground"
          >
            {Math.round(maxValue * tick)}
          </text>
        ))}

        {/* X-axis labels */}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 7)) === 0).map((d, i) => (
          <text
            key={i}
            x={padding.left + (i * Math.max(1, Math.floor(data.length / 7)) / (data.length - 1)) * innerWidth}
            y={chartHeight - 10}
            textAnchor="middle"
            className="text-[10px] fill-muted-foreground"
          >
            {formatDate(d.date)}
          </text>
        ))}

        {/* Lines */}
        {points.map(({ metric, color, path }) => (
          <path
            key={metric}
            d={generatePath(path)}
            fill="none"
            stroke={color}
            strokeWidth={hoveredMetric === metric ? 3 : 1.5}
            strokeOpacity={hoveredMetric === null || hoveredMetric === metric ? 1 : 0.3}
            className="transition-all duration-200 cursor-pointer"
            onMouseEnter={() => setHoveredMetric(metric)}
            onMouseLeave={() => setHoveredMetric(null)}
          />
        ))}

        {/* Hover indicator */}
        {hoveredIndex !== null && hoveredMetric && (
          <g>
            {points.filter(p => p.metric === hoveredMetric).map(({ path }) => {
              const point = path[hoveredIndex];
              if (!point) return null;
              return (
                <g key={hoveredMetric}>
                  <circle cx={point.x} cy={point.y} r={6} fill={METRIC_COLORS[hoveredMetric]} opacity={0.3} />
                  <circle cx={point.x} cy={point.y} r={4} fill={METRIC_COLORS[hoveredMetric]} />
                </g>
              );
            })}
          </g>
        )}

        {/* Data points on hover */}
        {hoveredIndex !== null && hoveredMetric === null && (
          <g>
            {points.map(({ metric, path }) => {
              const point = path[hoveredIndex];
              if (!point) return null;
              return (
                <circle
                  key={metric}
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill={METRIC_COLORS[metric]}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredMetric(metric)}
                />
              );
            })}
          </g>
        )}
      </svg>

      {showLegend && (
        <div className="flex flex-wrap gap-3 justify-center mt-4">
          {points.map(({ metric, color, label }) => (
            <button
              key={metric}
              onClick={() => setHoveredMetric(hoveredMetric === metric ? null : metric)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                hoveredMetric === null || hoveredMetric === metric
                  ? "bg-white/5 border border-white/10"
                  : "opacity-40"
              )}
            >
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Trend indicator component
interface TrendIndicatorProps {
  direction: TrendDirection;
  change: number;
  label?: string;
}

export function TrendIndicator({ direction, change, label }: TrendIndicatorProps) {
  const isPositive = change > 0;
  const color = direction === 'improving' ? 'text-emerald-400' : direction === 'declining' ? 'text-red-400' : 'text-muted-foreground';

  return (
    <div className={cn("flex items-center gap-1.5", color)}>
      {direction === 'improving' && <TrendingUp className="w-4 h-4" />}
      {direction === 'declining' && <TrendingDown className="w-4 h-4" />}
      {direction === 'stable' && <Minus className="w-4 h-4" />}
      <span className="text-sm font-bold">
        {isPositive ? '+' : ''}{change.toFixed(1)}
      </span>
      {label && <span className="text-xs text-muted-foreground ml-1">{label}</span>}
    </div>
  );
}

// Mini sparkline for compact displays
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 60, height = 20, color = '#d946ef' }: SparklineProps) {
  const max = Math.max(...data, 10);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

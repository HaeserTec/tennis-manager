import React from 'react';
import { SessionPlan } from '@/lib/playbook';
import { DrillThumbnail } from './DrillThumbnail';
import { LogoSvg } from './Logo';
import { cn } from '@/lib/utils';

interface SessionPlanDocumentProps {
  plan: SessionPlan;
  className?: string;
}

export const SessionPlanDocument = React.forwardRef<HTMLDivElement, SessionPlanDocumentProps>(
  ({ plan, className }, ref) => {
    // Total duration calculation
    const totalDuration = plan.items.reduce((acc, item) => acc + (item.durationMins || 0), 0);

    return (
      <div
        ref={ref}
        className={cn(
          "bg-white text-black w-[210mm] h-[297mm] mx-auto p-[10mm] shadow-xl print:shadow-none print:w-full print:h-[297mm] print:p-0 print:m-0 flex flex-col overflow-hidden",
          className
        )}
      >
        {/* Header */}
        <header className="border-b-2 border-zinc-900 pb-4 mb-4 flex justify-between items-start shrink-0">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold uppercase tracking-tight leading-none">
              {plan.name || "Untitled Session"}
            </h1>
            <div className="flex items-center gap-6 text-sm font-medium text-zinc-600">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {totalDuration} Mins
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                {plan.items.length} Drills
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="text-black">
            <LogoSvg className="h-14 w-auto text-black fill-black" />
          </div>
        </header>

        {/* Drills Content */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {plan.items.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-zinc-300 rounded-lg text-zinc-400">
              <p className="text-lg">No drills added to this plan.</p>
            </div>
          ) : (
            plan.items.map((item, index) => (
              <div key={item.id} className="flex-1 min-h-0 flex flex-col border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50/50">
                {/* Drill Header */}
                <div className="flex items-baseline gap-3 px-4 py-2 border-b border-zinc-200 bg-zinc-100/50 shrink-0">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black text-white text-xs font-bold shrink-0">
                    {index + 1}
                  </span>
                  <h2 className="text-lg font-bold text-black flex-1 leading-snug truncate">
                    {item.drill.name}
                  </h2>
                  <div className="flex gap-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    {item.drill.durationMins && <span>{item.drill.durationMins}m</span>}
                    {item.drill.intensity && <span>• {item.drill.intensity}</span>}
                    {item.drill.format && <span>• {item.drill.format}</span>}
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-row">
                  {/* Left: Thumbnail - Shrinkable */}
                  <div className="w-1/2 flex-1 min-w-0 flex flex-col justify-center p-3 bg-white border-r border-zinc-200 relative">
                     {/* Container to maintain aspect ratio but allow shrinking */}
                     <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                        <DrillThumbnail
                          drill={item.drill}
                          variant="print"
                          className="w-full h-auto max-h-full object-contain border border-zinc-300 rounded shadow-sm"
                        />
                     </div>
                  </div>

                  {/* Right: Details - Growable */}
                  <div className="w-1/2 flex-1 min-w-0 p-4 text-sm leading-relaxed overflow-hidden flex flex-col bg-white">
                    <div className="flex-1 min-h-0 space-y-3 overflow-hidden">
                        {item.drill.description && (
                          <div>
                            <h3 className="font-bold text-xs uppercase text-zinc-400 mb-1">Description</h3>
                            <p className="text-zinc-800 whitespace-pre-wrap">{item.drill.description}</p>
                          </div>
                        )}
                        
                        {item.drill.coachingPoints && (
                          <div className="p-3 bg-zinc-50 border border-zinc-100 rounded text-zinc-700">
                            <h3 className="font-bold text-xs uppercase text-zinc-400 mb-1">Coaching Points</h3>
                            <div className="whitespace-pre-wrap">{item.drill.coachingPoints}</div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <footer className="mt-4 pt-4 border-t border-zinc-200 flex justify-between items-center text-[10px] text-zinc-400 uppercase tracking-widest font-medium shrink-0">
          <span>Tennis Tactics Lab • Professional Academy Edition</span>
          <span>Page 1 of 1</span>
        </footer>
      </div>
    );
  }
);

SessionPlanDocument.displayName = 'SessionPlanDocument';
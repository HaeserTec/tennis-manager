import React, { useMemo } from 'react';
import type { Client, Player, SessionLog, TrainingSession } from '@/lib/playbook';

interface ClientWeeklyReportDocumentProps {
  client: Client;
  players: Player[];
  sessions: TrainingSession[];
  logs: SessionLog[];
  weekStart: Date;
  weekEnd: Date;
  onClose: () => void;
}

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export function ClientWeeklyReportDocument({
  client,
  players,
  sessions,
  logs,
  weekStart,
  weekEnd,
  onClose
}: ClientWeeklyReportDocumentProps) {
  const data = useMemo(() => {
    const myPlayers = players.filter((p) => p.clientId === client.id);
    const myPlayerIds = new Set(myPlayers.map((p) => p.id));
    const start = toISODate(weekStart);
    const end = toISODate(weekEnd);

    const weekSessions = sessions
      .filter((s) => s.date >= start && s.date <= end && s.participantIds.some((pid) => myPlayerIds.has(pid)))
      .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));

    const weekLogs = logs.filter((l) => l.date >= start && l.date <= end && l.isSharedWithParent && myPlayerIds.has(l.playerId));

    const perPlayer = myPlayers.map((player) => {
      const ps = weekSessions.filter((s) => s.participantIds.includes(player.id));
      const plogs = weekLogs.filter((l) => l.playerId === player.id).sort((a, b) => b.createdAt - a.createdAt);
      return {
        player,
        sessions: ps,
        logs: plogs,
        avgScore: plogs.length ? Number((plogs.reduce((sum, l) => sum + l.totalScore, 0) / plogs.length).toFixed(1)) : null
      };
    });

    return {
      myPlayers,
      weekSessions,
      weekLogs,
      perPlayer
    };
  }, [client.id, logs, players, sessions, weekEnd, weekStart]);

  return (
    <div className="fixed inset-0 z-[110] bg-white text-black overflow-y-auto print:overflow-visible flex flex-col items-center p-8 print:p-0">
      <div className="w-[210mm] mb-4 flex justify-between items-center no-print">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-bold text-gray-800"
        >
          &larr; Back
        </button>
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-bold text-white shadow-lg"
        >
          Print / Save PDF
        </button>
      </div>

      <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none p-[15mm] print:p-[10mm] relative flex flex-col font-sans">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-5">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Family Weekly Report</h1>
            <p className="text-xs text-gray-600 font-bold">
              {fmtDate(weekStart)} - {fmtDate(weekEnd)}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">{client.name}</p>
            <p>{client.email || 'No email on file'}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6 text-xs">
          <div className="border border-gray-300 rounded p-3">
            <div className="uppercase text-gray-500 font-black tracking-wider text-[10px]">Players</div>
            <div className="text-xl font-black mt-1">{data.myPlayers.length}</div>
          </div>
          <div className="border border-gray-300 rounded p-3">
            <div className="uppercase text-gray-500 font-black tracking-wider text-[10px]">Sessions This Week</div>
            <div className="text-xl font-black mt-1">{data.weekSessions.length}</div>
          </div>
          <div className="border border-gray-300 rounded p-3">
            <div className="uppercase text-gray-500 font-black tracking-wider text-[10px]">Shared Reports</div>
            <div className="text-xl font-black mt-1">{data.weekLogs.length}</div>
          </div>
        </div>

        <div className="space-y-5">
          {data.perPlayer.map((entry) => (
            <section key={entry.player.id} className="border border-gray-300 rounded-lg p-3">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2">
                <h2 className="text-base font-black">{entry.player.name}</h2>
                <div className="text-xs text-gray-600">
                  Avg shared score: <span className="font-bold">{entry.avgScore ?? '-'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <h3 className="font-bold uppercase tracking-wide text-[10px] text-gray-500 mb-2">Session Log</h3>
                  {entry.sessions.length > 0 ? (
                    <ul className="space-y-1">
                      {entry.sessions.map((s) => (
                        <li key={s.id} className="border border-gray-200 rounded px-2 py-1">
                          <span className="font-mono">{s.date}</span> {s.startTime}-{s.endTime} | {s.type} | {s.location}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="italic text-gray-500">No sessions this week.</p>
                  )}
                </div>
                <div>
                  <h3 className="font-bold uppercase tracking-wide text-[10px] text-gray-500 mb-2">Coach Insights</h3>
                  {entry.logs.length > 0 ? (
                    <ul className="space-y-1">
                      {entry.logs.slice(0, 4).map((l) => (
                        <li key={l.id} className="border border-gray-200 rounded px-2 py-1">
                          <div className="font-mono text-[10px]">{l.date} | Score {l.totalScore}/10</div>
                          <div>{l.nextFocus || l.note || 'No written note.'}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="italic text-gray-500">No shared insights this week.</p>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-auto pt-5 border-t border-gray-300 text-[10px] text-gray-500 text-center uppercase tracking-wider font-bold">
          Parent-Friendly Report | Generated from Tennis Lab Client Portal
        </div>
      </div>
    </div>
  );
}


"use client";

import type { RaceOverview } from "@/lib/api";

interface StrategyViewProps {
  overview: RaceOverview;
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#e10600",
  MEDIUM: "#fcd34d",
  HARD: "#f5f5f5",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
  Unknown: "#666666",
};

export default function StrategyView({ overview }: StrategyViewProps) {
  // Group pit strategies by driver
  const driverStrategies = overview.pit_strategies.reduce((acc, pit) => {
    if (!acc[pit.driver_code]) {
      acc[pit.driver_code] = [];
    }
    acc[pit.driver_code].push(pit);
    return acc;
  }, {} as Record<string, typeof overview.pit_strategies>);

  // Calculate strategy stats
  const totalPitStops = overview.pit_strategies.length;
  const avgStopsPerDriver = (totalPitStops / overview.metrics.total_drivers).toFixed(1);

  // Most common strategy (by number of stops)
  const stopCounts = Object.values(driverStrategies).map(strats => strats.length);
  const mostCommonStops = stopCounts.sort((a, b) =>
    stopCounts.filter(v => v === b).length - stopCounts.filter(v => v === a).length
  )[0];

  // Get unique drivers sorted by position
  const sortedDrivers = overview.race_results
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(r => r.driver_code);

  return (
    <div className="space-y-4">
      {/* Strategy KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Total Pit Stops</span>
            <span className="text-[7px] font-mono text-stone-600">[PIT]</span>
          </div>
          <div className="text-xl font-headline font-black text-on-surface">
            {totalPitStops}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Avg Stops/Driver</span>
            <span className="text-[7px] font-mono text-stone-600">[AVG]</span>
          </div>
          <div className="text-xl font-headline font-black text-on-surface">
            {avgStopsPerDriver}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Common Strategy</span>
            <span className="text-[7px] font-mono text-green-500">[OPT]</span>
          </div>
          <div className="text-xl font-headline font-black text-green-500">
            {mostCommonStops}-STOP
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Strategies</span>
            <span className="text-[7px] font-mono text-stone-600">[VAR]</span>
          </div>
          <div className="text-xl font-headline font-black text-on-surface">
            {new Set(stopCounts).size}
          </div>
        </div>
      </div>

      {/* Strategy Timeline Visualization */}
      <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
              Strategy Timeline
              <span className="text-[8px] font-mono text-stone-600 font-normal">STINT_VISUAL</span>
            </h2>
          </div>
          <div className="flex gap-4">
            {Object.entries(COMPOUND_COLORS).slice(0, 3).map(([compound, color]) => (
              <div key={compound} className="flex items-center gap-1.5">
                <span className="w-3 h-3" style={{ backgroundColor: color }} />
                <span className="text-[9px] font-bold font-mono uppercase">{compound}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {sortedDrivers.slice(0, 15).map((driverCode, idx) => {
            const stints = driverStrategies[driverCode] || [];
            const position = overview.race_results.find(r => r.driver_code === driverCode)?.position || 0;

            return (
              <div key={driverCode} className="flex items-center gap-3">
                <div className="w-8 text-right">
                  <span className={`text-[10px] font-mono font-bold ${
                    idx === 0 ? "text-yellow-500" : "text-stone-400"
                  }`}>
                    P{position}
                  </span>
                </div>
                <div className="w-12">
                  <span className="text-[10px] font-mono font-bold text-white">{driverCode}</span>
                </div>
                <div className="flex-1 flex h-6 bg-stone-900/50 overflow-hidden">
                  {stints.length > 0 ? (
                    stints.map((stint, stintIdx) => {
                      const stintLength = stint.lap_number;
                      const maxLaps = overview.metrics.total_laps / overview.metrics.total_drivers;
                      const widthPercent = Math.min((stintLength / maxLaps) * 100, 100 / stints.length);

                      return (
                        <div
                          key={`${driverCode}-${stintIdx}`}
                          className="h-full flex items-center justify-center border-r border-stone-900 last:border-r-0"
                          style={{
                            backgroundColor: COMPOUND_COLORS[stint.compound] || COMPOUND_COLORS.Unknown,
                            flex: 1,
                            opacity: 0.9,
                          }}
                        >
                          <span className="text-[8px] font-mono font-bold text-black/70">
                            {stint.compound.charAt(0)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-[8px] font-mono text-stone-600">NO DATA</span>
                    </div>
                  )}
                </div>
                <div className="w-16 text-right">
                  <span className="text-[9px] font-mono text-stone-500">{stints.length} STOP</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-stone-800 flex justify-between text-[8px] font-mono text-stone-600">
          <span>LAP 1</span>
          <span>MID RACE</span>
          <span>FINISH</span>
        </div>
      </div>

      {/* Pit Stop Details Table */}
      <div className="bg-surface border border-stone-800">
        <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
          <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em]">
            Pit Stop Log
          </h2>
          <span className="text-[7px] font-mono text-stone-600">[CHRONOLOGICAL]</span>
        </div>
        <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 z-10">
              <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-bold tracking-widest bg-stone-950">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Lap</th>
                <th className="px-4 py-3 font-medium">Compound</th>
                <th className="px-4 py-3 font-medium text-right">Stint Avg</th>
              </tr>
            </thead>
            <tbody className="text-[9px] font-mono">
              {overview.pit_strategies
                .slice()
                .sort((a, b) => a.lap_number - b.lap_number)
                .map((pit, idx) => (
                  <tr
                    key={`${pit.driver_code}-${pit.lap_number}-${idx}`}
                    className="border-b border-stone-800/50 hover:bg-stone-900/30"
                  >
                    <td className="px-4 py-2.5 text-stone-500">
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-2.5 text-white font-bold">{pit.driver_name}</td>
                    <td className="px-4 py-2.5 text-stone-400">LAP {pit.lap_number}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="px-2 py-0.5 text-[8px] font-bold uppercase"
                        style={{
                          backgroundColor: COMPOUND_COLORS[pit.compound] || COMPOUND_COLORS.Unknown,
                          color: pit.compound === "HARD" || pit.compound === "MEDIUM" ? "#000" : "#fff",
                        }}
                      >
                        {pit.compound}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-400">
                      {formatLapTime(pit.duration_seconds)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategy Summary by Driver */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
              Strategy Distribution
            </span>
            <span className="text-[7px] font-mono text-stone-600">[STOPS_COUNT]</span>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(stops => {
              const count = stopCounts.filter(s => s === stops).length;
              const percentage = (count / overview.metrics.total_drivers) * 100;

              if (count === 0) return null;

              return (
                <div key={stops} className="space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span className="font-mono text-stone-400">{stops}-STOP STRATEGY</span>
                    <span className="font-mono text-white font-bold">{count} drivers</span>
                  </div>
                  <div className="w-full bg-stone-900 h-2">
                    <div
                      className="h-full bg-primary-container"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
              Winning Strategy
            </span>
            <span className="text-[7px] font-mono text-yellow-500">[P1]</span>
          </div>
          {sortedDrivers[0] && driverStrategies[sortedDrivers[0]] && (
            <div>
              <div className="text-lg font-headline font-black text-yellow-500 mb-3">
                {sortedDrivers[0]} - {driverStrategies[sortedDrivers[0]].length}-STOP
              </div>
              <div className="flex gap-2">
                {driverStrategies[sortedDrivers[0]].map((stint, idx) => (
                  <div
                    key={idx}
                    className="flex-1 p-2 text-center"
                    style={{
                      backgroundColor: COMPOUND_COLORS[stint.compound] || COMPOUND_COLORS.Unknown,
                    }}
                  >
                    <div className="text-[8px] font-bold text-black/70 uppercase">
                      {stint.compound}
                    </div>
                    <div className="text-[10px] font-mono font-bold text-black/50">
                      L{stint.lap_number}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, "0")}`;
}

"use client";

import type { RaceOverview } from "@/lib/api";

const LINE_COLORS = ["#e10600", "#666666", "#00d2be", "#0090ff", "#ff8700", "#27f4d2"];

interface DriversViewProps {
  overview: RaceOverview;
}

export default function DriversView({ overview }: DriversViewProps) {
  const sortedResults = overview.race_results
    .slice()
    .sort((a, b) => a.position - b.position);

  const getPositionChange = (grid: number, position: number) => {
    const change = grid - position;
    if (change > 0) return { value: `+${change}`, color: "text-green-500" };
    if (change < 0) return { value: String(change), color: "text-red-500" };
    return { value: "=", color: "text-stone-500" };
  };

  const getTeamColor = (driverCode: string): string => {
    const teamColors: Record<string, string> = {
      VER: "#3671C6", PER: "#3671C6", // Red Bull
      HAM: "#27F4D2", RUS: "#27F4D2", // Mercedes
      LEC: "#E8002D", SAI: "#E8002D", // Ferrari
      NOR: "#FF8700", PIA: "#FF8700", // McLaren
      ALO: "#229971", STR: "#229971", // Aston Martin
      GAS: "#2293D1", OCO: "#2293D1", // Alpine
      TSU: "#6692FF", RIC: "#6692FF", DEV: "#6692FF", LAW: "#6692FF", // RB
      BOT: "#C92D4B", ZHO: "#C92D4B", // Alfa Romeo
      MAG: "#B6BABD", HUL: "#B6BABD", // Haas
      ALB: "#64C4FF", SAR: "#64C4FF", // Williams
    };
    return teamColors[driverCode] || "#666666";
  };

  return (
    <div className="space-y-4">
      {/* Driver Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Total Drivers</span>
            <span className="text-[7px] font-mono text-stone-600">[GRID]</span>
          </div>
          <div className="text-xl font-headline font-black text-on-surface">
            {overview.metrics.total_drivers}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Finishers</span>
            <span className="text-[7px] font-mono text-green-500">[OK]</span>
          </div>
          <div className="text-xl font-headline font-black text-green-500">
            {sortedResults.filter(r => r.status === "Finished").length}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">DNF</span>
            <span className="text-[7px] font-mono text-primary-container">[WARN]</span>
          </div>
          <div className="text-xl font-headline font-black text-primary-container">
            {sortedResults.filter(r => r.status !== "Finished").length}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Points Leader</span>
            <span className="text-[7px] font-mono text-yellow-500">[P1]</span>
          </div>
          <div className="text-xl font-headline font-black text-yellow-500">
            {sortedResults[0]?.driver_code || "--"}
          </div>
        </div>
      </div>

      {/* Driver Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedResults.slice(0, 12).map((driver, idx) => {
          const posChange = getPositionChange(driver.grid_position, driver.position);
          const teamColor = getTeamColor(driver.driver_code);
          const bestLap = overview.best_laps.find(l => l.driver_code === driver.driver_code);

          return (
            <div
              key={`${driver.driver_code}-${idx}`}
              className="bg-surface-container border border-stone-800 p-4 instrument-border relative overflow-hidden"
            >
              {/* Team color accent */}
              <div
                className="absolute top-0 left-0 w-1 h-full"
                style={{ backgroundColor: teamColor }}
              />

              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 flex items-center justify-center font-headline font-black text-sm ${
                      idx === 0 ? "bg-yellow-500/20 text-yellow-500" :
                      idx === 1 ? "bg-stone-400/20 text-stone-400" :
                      idx === 2 ? "bg-amber-600/20 text-amber-600" :
                      "bg-stone-800 text-stone-400"
                    }`}
                  >
                    {driver.status !== "Finished" ? "X" : driver.position}
                  </div>
                  <div>
                    <div className="font-headline font-bold text-white text-sm uppercase">
                      {driver.driver_name}
                    </div>
                    <div className="text-[9px] font-mono text-stone-500">
                      {driver.driver_code}
                    </div>
                  </div>
                </div>
                <div className={`text-xs font-mono font-bold ${posChange.color}`}>
                  {posChange.value}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-stone-900/50 p-2">
                  <div className="text-[7px] uppercase text-stone-600 mb-1">Grid</div>
                  <div className="text-sm font-bold font-mono">{driver.grid_position}</div>
                </div>
                <div className="bg-stone-900/50 p-2">
                  <div className="text-[7px] uppercase text-stone-600 mb-1">Points</div>
                  <div className="text-sm font-bold font-mono text-primary-container">
                    {driver.points}
                  </div>
                </div>
                <div className="bg-stone-900/50 p-2">
                  <div className="text-[7px] uppercase text-stone-600 mb-1">Best Lap</div>
                  <div className="text-[10px] font-bold font-mono">
                    {bestLap ? formatLapTime(bestLap.best_lap_time_seconds) : "--"}
                  </div>
                </div>
              </div>

              {driver.status !== "Finished" && (
                <div className="mt-3 pt-2 border-t border-stone-800">
                  <span className="text-[9px] font-mono text-primary-container uppercase">
                    {driver.status}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full Results Table */}
      <div className="bg-surface border border-stone-800">
        <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
          <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em]">
            Complete Driver Standings
          </h2>
          <span className="text-[7px] font-mono text-stone-600">[ALL_DRIVERS]</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-bold tracking-widest bg-stone-950">
                <th className="px-4 py-3 font-medium">Pos</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Grid</th>
                <th className="px-4 py-3 font-medium">Change</th>
                <th className="px-4 py-3 font-medium text-right">Points</th>
                <th className="px-4 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-[9px] font-mono">
              {sortedResults.map((row, idx) => {
                const posChange = getPositionChange(row.grid_position, row.position);
                return (
                  <tr
                    key={`${row.driver_code}-${row.position}-${idx}`}
                    className={`border-b border-stone-800/50 hover:bg-stone-900/30 ${
                      idx === 0 ? "bg-yellow-500/5" :
                      row.status !== "Finished" ? "bg-primary-container/5" : ""
                    }`}
                  >
                    <td className={`px-4 py-2.5 font-black ${
                      idx === 0 ? "text-yellow-500" :
                      row.status !== "Finished" ? "text-primary-container" : "text-stone-300"
                    }`}>
                      {row.status !== "Finished" ? "DNF" : String(row.position).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-0.5 h-4"
                          style={{ backgroundColor: getTeamColor(row.driver_code) }}
                        />
                        <span className={`font-bold ${row.status !== "Finished" ? "text-primary-container/80" : "text-white"}`}>
                          {row.driver_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-stone-400">{row.grid_position}</td>
                    <td className={`px-4 py-2.5 font-bold ${posChange.color}`}>
                      {posChange.value}
                    </td>
                    <td className="px-4 py-2.5 text-right text-primary-container font-bold">
                      {row.points}
                    </td>
                    <td className={`px-4 py-2.5 text-right uppercase ${
                      idx === 0 ? "text-yellow-500" :
                      row.status !== "Finished" ? "text-primary-container" : "text-stone-500"
                    }`}>
                      {idx === 0 ? "WINNER" : row.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

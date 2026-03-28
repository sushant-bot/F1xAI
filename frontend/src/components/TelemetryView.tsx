"use client";

import { useMemo, useState, useCallback } from "react";
import type { RaceOverview } from "@/lib/api";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TelemetryViewProps {
  overview: RaceOverview;
}

const DRIVER_COLORS: Record<string, string> = {
  VER: "#3671C6", PER: "#3671C6",
  HAM: "#27F4D2", RUS: "#27F4D2",
  LEC: "#E8002D", SAI: "#E8002D",
  NOR: "#FF8700", PIA: "#FF8700",
  ALO: "#229971", STR: "#229971",
  GAS: "#2293D1", OCO: "#2293D1",
  TSU: "#6692FF", RIC: "#6692FF", DEV: "#6692FF", LAW: "#6692FF",
  BOT: "#C92D4B", ZHO: "#C92D4B",
  MAG: "#B6BABD", HUL: "#B6BABD",
  ALB: "#64C4FF", SAR: "#64C4FF",
};

const LINE_COLORS = ["#e10600", "#27F4D2", "#0090ff", "#ff8700", "#22c55e", "#a855f7"];

const formatLapTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, "0")}`;
};

const formatDelta = (delta: number): string => {
  if (delta === 0) return "±0.000";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(3)}`;
};

// Custom F1-style tooltip component
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: number;
}

const CustomChartTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const sortedPayload = [...payload].sort((a, b) => a.value - b.value);
  const leaderTime = sortedPayload[0]?.value || 0;

  return (
    <div className="f1-tooltip" style={{ minWidth: 180 }}>
      <div className="f1-tooltip-label">LAP {label}</div>
      <div className="space-y-1">
        {sortedPayload.map((entry, idx) => {
          const delta = entry.value - leaderTime;
          return (
            <div key={entry.dataKey} className="f1-tooltip-item">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="f1-tooltip-driver">{entry.dataKey}</span>
                {idx === 0 && (
                  <span className="text-[8px] text-yellow-500 font-bold">FASTEST</span>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className="f1-tooltip-time">
                  {formatLapTime(entry.value)}
                </span>
                {idx > 0 && (
                  <span className="text-[9px] text-primary-container">
                    {formatDelta(delta)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function TelemetryView({ overview }: TelemetryViewProps) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const handleDriverClick = useCallback((driver: string) => {
    setSelectedDriver((prev) => (prev === driver ? null : driver));
  }, []);

  const lapChartData = useMemo(() => {
    const topDrivers = overview.best_laps.slice(0, 6).map((lap) => lap.driver_code);
    const filtered = overview.lap_times.filter(
      (lap) => topDrivers.includes(lap.driver_code) && lap.lap_number % 2 === 0,
    );

    const byLap = new Map<number, Record<string, number | string>>();
    for (const lap of filtered) {
      if (!byLap.has(lap.lap_number)) {
        byLap.set(lap.lap_number, { lap: lap.lap_number });
      }
      byLap.get(lap.lap_number)![lap.driver_code] = lap.lap_time_seconds;
    }

    return Array.from(byLap.values()).sort((a, b) => Number(a.lap) - Number(b.lap));
  }, [overview]);

  const topDrivers = overview.best_laps.slice(0, 6).map((lap) => lap.driver_code);
  const bestLap = overview.best_laps[0];
  const avgLapTime = overview.metrics.avg_lap_time_seconds;
  const totalLaps = overview.metrics.total_laps;
  const totalDrivers = overview.metrics.total_drivers;

  // Calculate delta between P1 and P2
  const delta = overview.best_laps.length >= 2
    ? (overview.best_laps[1].best_lap_time_seconds - overview.best_laps[0].best_lap_time_seconds).toFixed(3)
    : "0.000";

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border hover-lift">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500">Fastest Lap</span>
            <span className="text-[7px] font-mono text-purple-400">[S_REC]</span>
          </div>
          <div className="text-xl font-display font-black text-purple-400">
            {bestLap ? formatLapTime(bestLap.best_lap_time_seconds) : "--"}
          </div>
          <div className="mt-1 text-[8px] font-mono text-stone-500">
            {bestLap?.driver_code} - LAP {bestLap?.lap_number}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border hover-lift">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500">Avg Lap</span>
            <span className="text-[7px] font-mono text-stone-600">[AVG_ALL]</span>
          </div>
          <div className="text-xl font-display font-black text-on-surface">
            {formatLapTime(avgLapTime)}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border hover-lift">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500">P1-P2 Delta</span>
            <span className="text-[7px] font-mono text-primary-container">[GAP]</span>
          </div>
          <div className="text-xl font-display font-black text-primary-container">
            +{delta}<span className="text-xs ml-0.5 font-normal">s</span>
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border hover-lift">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500">Race Duration</span>
            <span className="text-[7px] font-mono text-stone-600">[TIME]</span>
          </div>
          <div className="text-xl font-display font-black text-on-surface">
            {overview.metrics.race_duration_seconds
              ? `${Math.floor(overview.metrics.race_duration_seconds / 3600)}h ${Math.floor((overview.metrics.race_duration_seconds % 3600) / 60)}m`
              : "--"}
          </div>
        </div>
      </div>

      {/* Telemetry Chart */}
      <div className="bg-surface-container border border-stone-800 p-4 flex flex-col relative overflow-hidden min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h2 className="chart-title">Lap Time Progression</h2>
            <p className="chart-subtitle mt-0.5">Top 6 drivers • Even laps displayed</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-1 mb-3">
          {topDrivers.map((driver, idx) => {
            const isSelected = selectedDriver === driver;
            const isFaded = selectedDriver && !isSelected;
            const color = DRIVER_COLORS[driver] || LINE_COLORS[idx % LINE_COLORS.length];

            return (
              <div
                key={driver}
                className={`legend-item flex items-center gap-1.5 ${
                  isSelected ? "selected" : ""
                } ${isFaded ? "faded" : ""}`}
                onClick={() => handleDriverClick(driver)}
              >
                <span
                  className="w-3 h-1"
                  style={{
                    backgroundColor: color,
                    boxShadow: isSelected ? `0 0 6px ${color}` : 'none'
                  }}
                />
                <span className="text-[9px] font-headline font-bold">{driver}</span>
              </div>
            );
          })}
          {selectedDriver && (
            <button
              className="text-[9px] text-stone-500 hover:text-white px-2 transition-colors"
              onClick={() => setSelectedDriver(null)}
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 relative min-h-[180px] sm:min-h-[300px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
            <LineChart data={lapChartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1f1f1f"
                strokeOpacity={0.5}
                horizontal={true}
                vertical={false}
              />
              <XAxis
                dataKey="lap"
                stroke="#444"
                tick={{ fill: "#555", fontSize: 9, fontFamily: "var(--font-rajdhani)" }}
                tickLine={{ stroke: "#333" }}
                axisLine={{ stroke: "#333" }}
                label={{
                  value: "LAP",
                  position: "insideBottomRight",
                  offset: -5,
                  style: { fill: "#444", fontSize: 8, fontFamily: "var(--font-rajdhani)" }
                }}
              />
              <YAxis
                stroke="#444"
                tick={{ fill: "#555", fontSize: 9, fontFamily: "ui-monospace" }}
                tickLine={{ stroke: "#333" }}
                axisLine={{ stroke: "#333" }}
                tickFormatter={(v) => `${v}s`}
                domain={["dataMin - 1", "dataMax + 1"]}
                width={50}
              />
              <Tooltip content={<CustomChartTooltip />} />
              {topDrivers.map((driver, idx) => {
                const isSelected = selectedDriver === driver;
                const isFaded = selectedDriver && !isSelected;
                const color = DRIVER_COLORS[driver] || LINE_COLORS[idx % LINE_COLORS.length];

                return (
                  <Line
                    key={driver}
                    type="monotone"
                    dataKey={driver}
                    stroke={color}
                    dot={false}
                    strokeWidth={isSelected ? 2.5 : isFaded ? 1 : 1.5}
                    strokeOpacity={isFaded ? 0.2 : 1}
                    style={{
                      filter: isSelected ? `drop-shadow(0 0 4px ${color})` : 'none'
                    }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Track Map & Sub-Systems */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface-container p-4 border border-stone-800 instrument-border h-fit">
          <div className="flex justify-between items-center mb-4">
            <span className="chart-title text-[11px]">
              Circuit // {overview.metrics.track_name.slice(0, 3).toUpperCase()}
            </span>
            <span className="text-[7px] font-mono text-green-500 bg-green-500/10 px-1 border border-green-500/20">
              OPTIMAL
            </span>
          </div>
          <div className="h-40 w-full flex items-center justify-center opacity-80">
            <svg className="w-full h-full max-w-[200px]" viewBox="0 0 200 200">
              <path
                className="stroke-stone-800 stroke-[0.5]"
                d="M0 0 L200 0 M0 50 L200 50 M0 100 L200 100 M0 150 L200 150 M0 200 L200 200 M50 0 L50 200 M100 0 L100 200 M150 0 L150 200"
                strokeDasharray="1 3"
              />
              <path
                className="stroke-stone-700 stroke-2"
                d="M40 140 L60 140 L80 150 L100 145 L130 155 L160 140 L170 110 L150 80 L160 60 L140 40 L100 50 L70 30 L40 50 L20 80 L40 110 Z"
                fill="none"
              />
              <path className="stroke-green-500 stroke-2" d="M40 140 L60 140 L80 150" fill="none" />
              <circle className="fill-white" cx="80" cy="150" r="2.5" />
            </svg>
          </div>
          <div className="flex justify-between mt-4 text-[7px] font-mono text-stone-500 border-t border-stone-800 pt-2">
            <span>S1: --</span>
            <span>S2: --</span>
            <span>S3: --</span>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {/* Tire Compounds */}
          <div className="bg-surface-container p-4 border border-stone-800 instrument-border">
            <div className="flex justify-between items-center mb-3">
              <span className="chart-title text-[11px]">Tire Distribution</span>
              <span className="text-[7px] font-mono text-stone-600">[COMPOUND_STATS]</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {overview.tire_compounds.slice(0, 3).map((tc) => (
                <div key={tc.compound} className="space-y-2">
                  <div className="flex justify-between text-[8px] uppercase font-headline font-bold text-stone-500">
                    <span>{tc.compound}</span>
                    <span>{tc.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-stone-900 h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        tc.compound === "SOFT"
                          ? "bg-red-500"
                          : tc.compound === "MEDIUM"
                          ? "bg-yellow-500"
                          : "bg-white"
                      }`}
                      style={{ width: `${tc.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Race Info */}
          <div className="bg-surface-container p-4 border border-stone-800 instrument-border">
            <div className="flex justify-between items-center mb-3">
              <span className="chart-title text-[11px]">Session Info</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-stone-900/40 hover-lift">
                <span className="text-[7px] uppercase text-stone-600 block font-headline tracking-wider">Laps</span>
                <span className="text-sm font-display font-bold text-primary-container">{totalLaps}</span>
              </div>
              <div className="text-center p-2 bg-stone-900/40 hover-lift">
                <span className="text-[7px] uppercase text-stone-600 block font-headline tracking-wider">Drivers</span>
                <span className="text-sm font-display font-bold">{totalDrivers}</span>
              </div>
              <div className="text-center p-2 bg-stone-900/40 hover-lift">
                <span className="text-[7px] uppercase text-stone-600 block font-headline tracking-wider">Date</span>
                <span className="text-sm font-display font-bold">
                  {new Date(overview.metrics.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Race Classification & Best Laps Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Results Table */}
        <div className="bg-surface border border-stone-800">
          <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
            <h2 className="chart-title text-[11px]">Race Classification</h2>
            <span className="text-[7px] font-mono text-stone-600">[TOP_10]</span>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-headline font-bold tracking-widest bg-stone-950">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium text-right">Points</th>
                </tr>
              </thead>
              <tbody className="text-[9px] font-mono">
                {overview.race_results
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .slice(0, 10)
                  .map((row, idx) => (
                    <tr
                      key={`${row.driver_code}-${row.position}-${idx}`}
                      className={`border-b border-stone-800/50 transition-all duration-200 hover:bg-white/5 ${
                        idx === 0 ? "bg-yellow-500/5" :
                        row.status !== "Finished" ? "bg-primary-container/5" : ""
                      }`}
                    >
                      <td className={`px-4 py-2.5 font-black ${
                        idx === 0 ? "text-yellow-500" :
                        row.status !== "Finished" ? "text-primary-container" : "text-stone-300"
                      }`}>
                        {row.status !== "Finished" ? "OUT" : String(row.position).padStart(2, "0")}
                      </td>
                      <td className={`px-4 py-2.5 ${
                        row.status !== "Finished" ? "text-primary-container/80" : "text-white"
                      }`}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-0.5 h-4"
                            style={{ backgroundColor: DRIVER_COLORS[row.driver_code] || "#666" }}
                          />
                          <span className="font-bold">{row.driver_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-primary-container font-bold">
                        {row.points}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Best Laps Table */}
        <div className="bg-surface border border-stone-800">
          <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
            <h2 className="chart-title text-[11px]">Best Lap Ranking</h2>
            <span className="text-[7px] font-mono text-stone-600">[TOP_10]</span>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-headline font-bold tracking-widest bg-stone-950">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="text-[9px] font-mono">
                {overview.best_laps.slice(0, 10).map((row, idx) => (
                  <tr
                    key={`${row.driver_code}-${idx}`}
                    className={`border-b border-stone-800/50 transition-all duration-200 hover:bg-white/5 ${idx === 0 ? "bg-purple-500/5" : ""}`}
                  >
                    <td className={`px-4 py-2.5 font-black ${
                      idx === 0 ? "text-purple-400" : "text-stone-300"
                    }`}>
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-0.5 h-4"
                          style={{ backgroundColor: DRIVER_COLORS[row.driver_code] || "#666" }}
                        />
                        <span className="text-white font-bold">{row.driver_name}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-2.5 text-right ${
                      idx === 0 ? "text-purple-400" : "text-stone-400"
                    }`}>
                      {formatLapTime(row.best_lap_time_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

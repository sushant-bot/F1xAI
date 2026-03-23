"use client";

import { useMemo } from "react";
import type { RaceOverview } from "@/lib/api";
import {
  CartesianGrid,
  Legend,
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

const LINE_COLORS = ["#e10600", "#27F4D2", "#0090ff", "#ff8700", "#22c55e", "#a855f7"];

const formatLapTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, "0")}`;
};

export default function TelemetryView({ overview }: TelemetryViewProps) {
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
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Fastest Lap</span>
            <span className="text-[7px] font-mono text-purple-400">[S_REC]</span>
          </div>
          <div className="text-xl font-headline font-black text-purple-400">
            {bestLap ? formatLapTime(bestLap.best_lap_time_seconds) : "--"}
          </div>
          <div className="mt-1 text-[8px] font-mono text-stone-500">
            {bestLap?.driver_code} - LAP {bestLap?.lap_number}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Avg Lap</span>
            <span className="text-[7px] font-mono text-stone-600">[AVG_ALL]</span>
          </div>
          <div className="text-xl font-headline font-black text-on-surface">
            {formatLapTime(avgLapTime)}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">P1-P2 Delta</span>
            <span className="text-[7px] font-mono text-primary-container">[GAP]</span>
          </div>
          <div className="text-xl font-headline font-black text-primary-container">
            +{delta}<span className="text-xs ml-0.5 font-normal">s</span>
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Race Duration</span>
            <span className="text-[7px] font-mono text-stone-600">[TIME]</span>
          </div>
          <div className="text-xl font-headline font-black text-on-surface">
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
            <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
              Lap Time Progression
              <span className="text-[8px] font-mono text-stone-600 font-normal">TOP_6_DRIVERS</span>
            </h2>
          </div>
          <div className="flex gap-4 flex-wrap">
            {topDrivers.slice(0, 4).map((driver, idx) => (
              <div key={driver} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-0.5"
                  style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
                />
                <span className="text-[9px] font-bold font-mono">{driver}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 relative min-h-[180px] sm:min-h-[300px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
            <LineChart data={lapChartData}>
              <CartesianGrid strokeDasharray="2 2" stroke="#333" />
              <XAxis
                dataKey="lap"
                stroke="#666"
                tick={{ fill: "#666", fontSize: 10 }}
                tickLine={{ stroke: "#333" }}
              />
              <YAxis
                stroke="#666"
                tick={{ fill: "#666", fontSize: 10 }}
                tickLine={{ stroke: "#333" }}
                tickFormatter={(v) => `${v}s`}
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#181818",
                  border: "1px solid #333",
                  borderRadius: 0,
                  fontSize: 10,
                }}
                labelStyle={{ color: "#e5e2e1" }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {topDrivers.map((driver, idx) => (
                <Line
                  key={driver}
                  type="monotone"
                  dataKey={driver}
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                  dot={false}
                  strokeWidth={1.5}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Track Map & Sub-Systems */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface-container p-4 border border-stone-800 instrument-border h-fit">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
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
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                Tire Distribution
              </span>
              <span className="text-[7px] font-mono text-stone-600">[COMPOUND_STATS]</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {overview.tire_compounds.slice(0, 3).map((tc) => (
                <div key={tc.compound} className="space-y-2">
                  <div className="flex justify-between text-[8px] uppercase font-bold text-stone-500">
                    <span>{tc.compound}</span>
                    <span>{tc.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-stone-900 h-1">
                    <div
                      className={`h-full ${
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
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                Session Info
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-stone-900/40">
                <span className="text-[7px] uppercase text-stone-600 block">Laps</span>
                <span className="text-sm font-bold text-primary-container">{totalLaps}</span>
              </div>
              <div className="text-center p-2 bg-stone-900/40">
                <span className="text-[7px] uppercase text-stone-600 block">Drivers</span>
                <span className="text-sm font-bold">{totalDrivers}</span>
              </div>
              <div className="text-center p-2 bg-stone-900/40">
                <span className="text-[7px] uppercase text-stone-600 block">Date</span>
                <span className="text-sm font-bold">
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
            <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em]">
              Race Classification
            </h2>
            <span className="text-[7px] font-mono text-stone-600">[TOP_10]</span>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-bold tracking-widest bg-stone-950">
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
                      className={`border-b border-stone-800/50 ${
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
                      <td className={`px-4 py-2.5 font-bold ${
                        row.status !== "Finished" ? "text-primary-container/80" : "text-white"
                      }`}>
                        {row.driver_name}
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
            <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em]">
              Best Lap Ranking
            </h2>
            <span className="text-[7px] font-mono text-stone-600">[TOP_10]</span>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-bold tracking-widest bg-stone-950">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="text-[9px] font-mono">
                {overview.best_laps.slice(0, 10).map((row, idx) => (
                  <tr
                    key={`${row.driver_code}-${idx}`}
                    className={`border-b border-stone-800/50 ${idx === 0 ? "bg-purple-500/5" : ""}`}
                  >
                    <td className={`px-4 py-2.5 font-black ${
                      idx === 0 ? "text-purple-400" : "text-stone-300"
                    }`}>
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-2.5 text-white font-bold">{row.driver_name}</td>
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

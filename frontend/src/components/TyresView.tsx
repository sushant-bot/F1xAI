"use client";

import type { RaceOverview } from "@/lib/api";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface TyresViewProps {
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

const COMPOUND_BG: Record<string, string> = {
  SOFT: "bg-red-500",
  MEDIUM: "bg-yellow-400",
  HARD: "bg-white",
  INTERMEDIATE: "bg-green-500",
  WET: "bg-blue-500",
  Unknown: "bg-stone-500",
};

export default function TyresView({ overview }: TyresViewProps) {
  const tireCompounds = overview.tire_compounds;

  // Use race lap count (e.g., 57) instead of summed per-driver lap records.
  const totalLaps = overview.metrics.total_laps;

  // Get most used compound
  const mostUsed = tireCompounds.reduce((max, tc) =>
    tc.count > max.count ? tc : max, tireCompounds[0]
  );

  // Prepare data for pie chart
  const pieData = tireCompounds.map(tc => ({
    name: tc.compound,
    value: tc.count,
    fill: COMPOUND_COLORS[tc.compound] || COMPOUND_COLORS.Unknown,
  }));

  // Calculate average stint length per compound from pit strategies
  const compoundStints = overview.pit_strategies.reduce((acc, pit) => {
    if (!acc[pit.compound]) {
      acc[pit.compound] = { totalLaps: 0, stints: 0 };
    }
    acc[pit.compound].totalLaps += pit.lap_number;
    acc[pit.compound].stints += 1;
    return acc;
  }, {} as Record<string, { totalLaps: number; stints: number }>);

  const avgStintData = Object.entries(compoundStints).map(([compound, data]) => ({
    compound,
    avgLaps: Math.round(data.totalLaps / data.stints),
    stints: data.stints,
  }));

  // Get best lap time per compound from lap times
  const compoundBestLaps = overview.lap_times.reduce((acc, lap) => {
    const compound = overview.pit_strategies.find(
      p => p.driver_code === lap.driver_code
    )?.compound || "Unknown";

    if (!acc[compound] || lap.lap_time_seconds < acc[compound].time) {
      acc[compound] = {
        time: lap.lap_time_seconds,
        driver: lap.driver_code,
        lap: lap.lap_number,
      };
    }
    return acc;
  }, {} as Record<string, { time: number; driver: string; lap: number }>);

  return (
    <div className="space-y-4">
      {/* Tire KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Total Lap Data</span>
            <span className="text-[7px] font-mono text-stone-600">[COUNT]</span>
          </div>
          <div className="text-xl font-headline font-black text-on-surface">
            {totalLaps}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Compounds Used</span>
            <span className="text-[7px] font-mono text-stone-600">[VAR]</span>
          </div>
          <div className="text-xl font-headline font-black text-on-surface">
            {tireCompounds.length}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Most Used</span>
            <span className="text-[7px] font-mono" style={{ color: COMPOUND_COLORS[mostUsed?.compound] }}>[TOP]</span>
          </div>
          <div
            className="text-xl font-headline font-black"
            style={{ color: COMPOUND_COLORS[mostUsed?.compound] }}
          >
            {mostUsed?.compound || "--"}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Usage %</span>
            <span className="text-[7px] font-mono text-stone-600">[DOM]</span>
          </div>
          <div className="text-xl font-headline font-black text-primary-container">
            {mostUsed?.percentage.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Tire Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <div className="bg-surface-container border border-stone-800 p-4 instrument-border min-w-0">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                Compound Distribution
                <span className="text-[8px] font-mono text-stone-600 font-normal">PIE_VIS</span>
              </h2>
            </div>
          </div>
          <div className="h-[250px] min-w-0 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  strokeWidth={2}
                  stroke="#0e0e0e"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#181818",
                    border: "1px solid #333",
                    borderRadius: 0,
                    fontSize: 10,
                  }}
                  formatter={(value, name) => {
                    const numValue = typeof value === "number" ? value : 0;
                    const pct = totalLaps > 0 ? ((numValue / totalLaps) * 100).toFixed(1) : "0.0";
                    return [
                      `${numValue} laps (${pct}%)`,
                      String(name),
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {tireCompounds.map(tc => (
              <div key={tc.compound} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3"
                  style={{ backgroundColor: COMPOUND_COLORS[tc.compound] }}
                />
                <span className="text-[9px] font-mono text-stone-400">{tc.compound}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-surface-container border border-stone-800 p-4 instrument-border min-w-0">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                Lap Count by Compound
                <span className="text-[8px] font-mono text-stone-600 font-normal">BAR_VIS</span>
              </h2>
            </div>
          </div>
          <div className="h-[250px] min-w-0 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
              <BarChart data={tireCompounds} layout="vertical">
                <CartesianGrid strokeDasharray="2 2" stroke="#333" horizontal={false} />
                <XAxis type="number" stroke="#666" tick={{ fill: "#666", fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="compound"
                  stroke="#666"
                  tick={{ fill: "#666", fontSize: 10 }}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#181818",
                    border: "1px solid #333",
                    borderRadius: 0,
                    fontSize: 10,
                  }}
                />
                <Bar dataKey="count" name="Laps">
                  {tireCompounds.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COMPOUND_COLORS[entry.compound] || COMPOUND_COLORS.Unknown}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Compound Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tireCompounds.map(tc => (
          <div
            key={tc.compound}
            className="bg-surface-container border border-stone-800 p-4 instrument-border relative overflow-hidden"
          >
            {/* Compound color accent */}
            <div
              className="absolute top-0 left-0 w-full h-1"
              style={{ backgroundColor: COMPOUND_COLORS[tc.compound] }}
            />

            <div className="flex justify-between items-start mb-4">
              <div>
                <div
                  className="text-lg font-headline font-black uppercase"
                  style={{ color: COMPOUND_COLORS[tc.compound] }}
                >
                  {tc.compound}
                </div>
                <div className="text-[8px] font-mono text-stone-600">COMPOUND_DATA</div>
              </div>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: COMPOUND_COLORS[tc.compound] }}
              >
                <span className="text-black font-bold text-xs">{tc.compound.charAt(0)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-stone-900/50 p-2">
                <div className="text-[7px] uppercase text-stone-600 mb-1">Lap Count</div>
                <div className="text-sm font-bold font-mono">{tc.count}</div>
              </div>
              <div className="bg-stone-900/50 p-2">
                <div className="text-[7px] uppercase text-stone-600 mb-1">Usage</div>
                <div className="text-sm font-bold font-mono text-primary-container">
                  {tc.percentage.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Usage bar */}
            <div className="mt-3">
              <div className="w-full bg-stone-900 h-2">
                <div
                  className="h-full transition-all"
                  style={{
                    backgroundColor: COMPOUND_COLORS[tc.compound],
                    width: `${tc.percentage}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stint Analysis */}
      {avgStintData.length > 0 && (
        <div className="bg-surface border border-stone-800">
          <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
            <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em]">
              Stint Analysis
            </h2>
            <span className="text-[7px] font-mono text-stone-600">[AVG_STINT_LENGTH]</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-bold tracking-widest bg-stone-950">
                  <th className="px-4 py-3 font-medium">Compound</th>
                  <th className="px-4 py-3 font-medium">Total Stints</th>
                  <th className="px-4 py-3 font-medium">Avg Stint Length</th>
                  <th className="px-4 py-3 font-medium">Visual</th>
                </tr>
              </thead>
              <tbody className="text-[9px] font-mono">
                {avgStintData.map((data, idx) => (
                  <tr
                    key={data.compound}
                    className="border-b border-stone-800/50 hover:bg-stone-900/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3"
                          style={{ backgroundColor: COMPOUND_COLORS[data.compound] }}
                        />
                        <span className="font-bold text-white uppercase">{data.compound}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-400">{data.stints}</td>
                    <td className="px-4 py-3 text-primary-container font-bold">
                      ~{data.avgLaps} LAPS
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-32 bg-stone-900 h-2">
                        <div
                          className="h-full"
                          style={{
                            backgroundColor: COMPOUND_COLORS[data.compound],
                            width: `${Math.min(data.avgLaps * 2, 100)}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tire Legend */}
      <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
            Compound Reference
          </span>
          <span className="text-[7px] font-mono text-stone-600">[PIRELLI_2023]</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(COMPOUND_COLORS).filter(([k]) => k !== "Unknown").map(([compound, color]) => (
            <div
              key={compound}
              className="flex items-center gap-3 p-2 bg-stone-900/30"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: color }}
              >
                <span className="text-black font-bold text-xs">{compound.charAt(0)}</span>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase" style={{ color }}>
                  {compound}
                </div>
                <div className="text-[7px] text-stone-600 font-mono">
                  {compound === "SOFT" && "GRIP+++"}
                  {compound === "MEDIUM" && "BALANCED"}
                  {compound === "HARD" && "DURABLE"}
                  {compound === "INTERMEDIATE" && "DAMP"}
                  {compound === "WET" && "RAIN"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

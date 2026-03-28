"use client";

import { useMemo, useState, useCallback } from "react";
import type { RaceOverview } from "@/lib/api";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface GapAnalysisViewProps {
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

const LINE_COLORS = ["#e10600", "#27F4D2", "#0090ff", "#ff8700", "#22c55e", "#a855f7", "#f59e0b", "#ec4899"];

// Custom tooltip for gap charts
interface GapTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: number;
}

const GapChartTooltip = ({ active, payload, label }: GapTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const sortedPayload = [...payload].sort((a, b) => a.value - b.value);

  return (
    <div className="f1-tooltip" style={{ minWidth: 160 }}>
      <div className="f1-tooltip-label">LAP {label}</div>
      <div className="space-y-1">
        {sortedPayload.map((entry) => (
          <div key={entry.dataKey} className="f1-tooltip-item">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2"
                style={{ backgroundColor: entry.color }}
              />
              <span className="f1-tooltip-driver">{entry.dataKey}</span>
            </div>
            <span className="f1-tooltip-time">+{entry.value.toFixed(3)}s</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const PositionTooltip = ({ active, payload, label }: GapTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const sortedPayload = [...payload].sort((a, b) => a.value - b.value);

  return (
    <div className="f1-tooltip" style={{ minWidth: 160 }}>
      <div className="f1-tooltip-label">LAP {label}</div>
      <div className="space-y-1">
        {sortedPayload.map((entry) => (
          <div key={entry.dataKey} className="f1-tooltip-item">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2"
                style={{ backgroundColor: entry.color }}
              />
              <span className="f1-tooltip-driver">{entry.dataKey}</span>
            </div>
            <span className={`f1-tooltip-time ${entry.value === 1 ? "text-yellow-500" : ""}`}>
              P{entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function GapAnalysisView({ overview }: GapAnalysisViewProps) {
  const [compareMode, setCompareMode] = useState<"leader" | "ahead">("leader");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const handleDriverClick = useCallback((driver: string) => {
    setSelectedDriver((prev) => (prev === driver ? null : driver));
  }, []);

  // Get sorted race results
  const sortedResults = useMemo(() => {
    return overview.race_results
      .slice()
      .sort((a, b) => a.position - b.position);
  }, [overview.race_results]);

  // Calculate cumulative lap times for gap analysis
  const gapData = useMemo(() => {
    const topDrivers = sortedResults.slice(0, 6).map((r) => r.driver_code);

    if (overview.lap_times.length === 0) {
      return { topDrivers, gapChartData: [] };
    }

    // Group lap times by driver
    const driverLaps: Record<string, { lap: number; time: number }[]> = {};
    for (const lap of overview.lap_times) {
      if (!topDrivers.includes(lap.driver_code)) continue;
      if (!driverLaps[lap.driver_code]) {
        driverLaps[lap.driver_code] = [];
      }
      driverLaps[lap.driver_code].push({
        lap: lap.lap_number,
        time: lap.lap_time_seconds,
      });
    }

    // Calculate cumulative times
    const cumulativeTimes: Record<string, Record<number, number>> = {};
    for (const driver of topDrivers) {
      const laps = driverLaps[driver] || [];
      laps.sort((a, b) => a.lap - b.lap);
      cumulativeTimes[driver] = {};
      let cumulative = 0;
      for (const lap of laps) {
        cumulative += lap.time;
        cumulativeTimes[driver][lap.lap] = cumulative;
      }
    }

    // Get leader laps
    const leader = topDrivers[0];
    const leaderLapsObj = cumulativeTimes[leader] || {};
    const allLaps = Object.keys(leaderLapsObj).map(Number).sort((a, b) => a - b);

    // Sample every N laps based on total
    const sampleRate = Math.max(1, Math.floor(allLaps.length / 20));
    const sampledLaps = allLaps.filter((_, i) => i % sampleRate === 0 || i === allLaps.length - 1);

    const gapChartData: Record<string, number | string>[] = [];
    for (const lapNum of sampledLaps) {
      const entry: Record<string, number | string> = { lap: lapNum };
      const leaderTime = cumulativeTimes[leader]?.[lapNum] || 0;

      for (const driver of topDrivers) {
        const driverTime = cumulativeTimes[driver]?.[lapNum];
        if (driverTime && leaderTime) {
          entry[driver] = parseFloat((driverTime - leaderTime).toFixed(3));
        }
      }

      // Only add if we have data
      if (Object.keys(entry).length > 1) {
        gapChartData.push(entry);
      }
    }

    return { topDrivers, gapChartData };
  }, [overview.lap_times, sortedResults]);

  // Calculate position progression
  const positionData = useMemo(() => {
    const topDrivers = sortedResults.slice(0, 8).map((r) => r.driver_code);

    if (overview.lap_times.length === 0) {
      return { topDrivers, positionChartData: [] };
    }

    // Calculate cumulative times per driver
    const driverCumulativeTimes: Record<string, { lap: number; cumTime: number }[]> = {};

    for (const driver of topDrivers) {
      const driverLaps = overview.lap_times
        .filter((l) => l.driver_code === driver)
        .sort((a, b) => a.lap_number - b.lap_number);

      let cumTime = 0;
      driverCumulativeTimes[driver] = driverLaps.map((l) => {
        cumTime += l.lap_time_seconds;
        return { lap: l.lap_number, cumTime };
      });
    }

    // Get all unique laps
    const allLapsSet = new Set<number>();
    for (const driver of topDrivers) {
      for (const entry of driverCumulativeTimes[driver] || []) {
        allLapsSet.add(entry.lap);
      }
    }

    const allLaps = Array.from(allLapsSet).sort((a, b) => a - b);
    const sampleRate = Math.max(1, Math.floor(allLaps.length / 15));
    const sampledLaps = allLaps.filter((_, i) => i % sampleRate === 0 || i === allLaps.length - 1);

    const positionChartData: Record<string, number | string>[] = [];
    for (const lapNum of sampledLaps) {
      const lapTimes: { driver: string; cumTime: number }[] = [];

      for (const driver of topDrivers) {
        // Find the closest lap entry
        const entries = driverCumulativeTimes[driver] || [];
        const entry = entries.find((e) => e.lap === lapNum) ||
                      entries.filter((e) => e.lap <= lapNum).pop();
        if (entry) {
          lapTimes.push({ driver, cumTime: entry.cumTime });
        }
      }

      lapTimes.sort((a, b) => a.cumTime - b.cumTime);

      const posEntry: Record<string, number | string> = { lap: lapNum };
      lapTimes.forEach((lt, idx) => {
        posEntry[lt.driver] = idx + 1;
      });

      if (Object.keys(posEntry).length > 1) {
        positionChartData.push(posEntry);
      }
    }

    return { topDrivers, positionChartData };
  }, [overview.lap_times, sortedResults]);

  // Calculate interval gaps using race results
  const intervalGaps = useMemo(() => {
    // Calculate gaps based on cumulative lap times if available, otherwise use best_laps
    const driverTotalTimes: Record<string, number> = {};

    for (const driver of sortedResults) {
      const driverLaps = overview.lap_times.filter(l => l.driver_code === driver.driver_code);
      if (driverLaps.length > 0) {
        driverTotalTimes[driver.driver_code] = driverLaps.reduce((sum, l) => sum + l.lap_time_seconds, 0);
      }
    }

    const leaderTime = driverTotalTimes[sortedResults[0]?.driver_code] || 0;

    return sortedResults.map((driver, idx) => {
      let gapToLeader = driver.time_diff_seconds ?? 0;
      let gapToAhead = 0;

      // If time_diff_seconds is not available, calculate from lap times
      if (gapToLeader === 0 && leaderTime > 0 && driverTotalTimes[driver.driver_code]) {
        gapToLeader = driverTotalTimes[driver.driver_code] - leaderTime;
      }

      if (idx > 0) {
        const aheadGap = sortedResults[idx - 1].time_diff_seconds ?? 0;
        const currentGap = driver.time_diff_seconds ?? 0;

        if (currentGap > 0 || aheadGap > 0) {
          gapToAhead = currentGap - aheadGap;
        } else if (driverTotalTimes[driver.driver_code] && driverTotalTimes[sortedResults[idx - 1].driver_code]) {
          gapToAhead = driverTotalTimes[driver.driver_code] - driverTotalTimes[sortedResults[idx - 1].driver_code];
        }
      }

      return {
        ...driver,
        gap_to_leader: Math.max(0, gapToLeader),
        gap_to_ahead: Math.max(0, gapToAhead),
      };
    });
  }, [overview.lap_times, sortedResults]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const finishers = sortedResults.filter((r) => r.status === "Finished" || r.laps_completed > 0);

    // Winner gap
    const winnerGap = intervalGaps[1]?.gap_to_leader || 0;
    const lastPlaceGap = intervalGaps[intervalGaps.length - 1]?.gap_to_leader || 0;

    // Find closest battle
    let closestGap = Infinity;
    let closestPair = "";
    for (let i = 1; i < intervalGaps.length; i++) {
      const gap = intervalGaps[i].gap_to_ahead;
      if (gap < closestGap && gap > 0) {
        closestGap = gap;
        closestPair = `P${intervalGaps[i - 1].position}-P${intervalGaps[i].position}`;
      }
    }

    // Average gap
    const gaps = intervalGaps.slice(1).map(d => d.gap_to_ahead).filter(g => g > 0);
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

    return {
      winnerGap,
      lastPlaceGap,
      closestGap: closestGap === Infinity ? 0 : closestGap,
      closestPair,
      avgGap,
    };
  }, [intervalGaps, sortedResults]);

  return (
    <div className="space-y-4">
      {/* Gap Analysis KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border hover-lift">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500">Winner Margin</span>
            <span className="text-[7px] font-mono text-yellow-500">[P1-P2]</span>
          </div>
          <div className="text-xl font-display font-black text-yellow-500">
            +{kpis.winnerGap.toFixed(3)}<span className="text-xs ml-0.5 font-normal">s</span>
          </div>
          <div className="mt-1 text-[8px] font-mono text-stone-500">
            {sortedResults[0]?.driver_code || "--"} over {sortedResults[1]?.driver_code || "--"}
          </div>
        </div>

        <div className="bg-surface-container border border-stone-800 p-3 instrument-border hover-lift">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500">Closest Battle</span>
            <span className="text-[7px] font-mono text-green-500">[GAP]</span>
          </div>
          <div className="text-xl font-display font-black text-green-500">
            +{kpis.closestGap.toFixed(3)}<span className="text-xs ml-0.5 font-normal">s</span>
          </div>
          <div className="mt-1 text-[8px] font-mono text-stone-500">
            {kpis.closestPair || "--"}
          </div>
        </div>

        <div className="bg-surface-container border border-stone-800 p-3 instrument-border hover-lift">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500">Avg Gap</span>
            <span className="text-[7px] font-mono text-stone-600">[INTERVAL]</span>
          </div>
          <div className="text-xl font-display font-black text-on-surface">
            +{kpis.avgGap.toFixed(2)}<span className="text-xs ml-0.5 font-normal">s</span>
          </div>
        </div>

        <div className="bg-surface-container border border-stone-800 p-3 instrument-border hover-lift">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500">Field Spread</span>
            <span className="text-[7px] font-mono text-primary-container">[P1-LAST]</span>
          </div>
          <div className="text-xl font-display font-black text-primary-container">
            {kpis.lastPlaceGap > 0 ? `+${Math.floor(kpis.lastPlaceGap)}` : "--"}<span className="text-xs ml-0.5 font-normal">s</span>
          </div>
        </div>
      </div>

      {/* Gap to Leader Chart */}
      <div className="bg-surface-container border border-stone-800 p-4 flex flex-col relative overflow-hidden min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h2 className="chart-title">Gap to Leader</h2>
            <p className="chart-subtitle mt-0.5">Cumulative time delta over race distance</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-1 mb-3">
          {gapData.topDrivers.slice(1, 6).map((driver, idx) => {
            const isSelected = selectedDriver === driver;
            const isFaded = selectedDriver && !isSelected;
            const color = DRIVER_COLORS[driver] || LINE_COLORS[idx];

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

        <div className="flex-1 relative min-h-[200px] sm:min-h-[280px] min-w-0">
          {gapData.gapChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <AreaChart data={gapData.gapChartData}>
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
                />
                <YAxis
                  stroke="#444"
                  tick={{ fill: "#555", fontSize: 9, fontFamily: "ui-monospace" }}
                  tickLine={{ stroke: "#333" }}
                  axisLine={{ stroke: "#333" }}
                  tickFormatter={(v) => `+${v}s`}
                  domain={[0, "auto"]}
                  width={50}
                />
                <Tooltip content={<GapChartTooltip />} />
                {gapData.topDrivers.slice(1, 6).map((driver, idx) => {
                  const isSelected = selectedDriver === driver;
                  const isFaded = selectedDriver && !isSelected;
                  const color = DRIVER_COLORS[driver] || LINE_COLORS[idx];

                  return (
                    <Area
                      key={driver}
                      type="monotone"
                      dataKey={driver}
                      stroke={color}
                      fill={color}
                      fillOpacity={isFaded ? 0.02 : isSelected ? 0.15 : 0.08}
                      strokeWidth={isSelected ? 2 : isFaded ? 1 : 1.5}
                      strokeOpacity={isFaded ? 0.2 : 1}
                      style={{
                        filter: isSelected ? `drop-shadow(0 0 4px ${color})` : 'none'
                      }}
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-stone-600 text-[10px] font-mono">
              NO LAP TIME DATA AVAILABLE
            </div>
          )}
        </div>
      </div>

      {/* Position Battle Chart */}
      <div className="bg-surface-container border border-stone-800 p-4 flex flex-col relative overflow-hidden min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h2 className="chart-title">Position Battle</h2>
            <p className="chart-subtitle mt-0.5">Track position changes throughout the race</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-1 mb-3">
          {positionData.topDrivers.slice(0, 6).map((driver, idx) => {
            const isSelected = selectedDriver === driver;
            const isFaded = selectedDriver && !isSelected;
            const color = DRIVER_COLORS[driver] || LINE_COLORS[idx];

            return (
              <div
                key={driver}
                className={`legend-item flex items-center gap-1.5 ${
                  isSelected ? "selected" : ""
                } ${isFaded ? "faded" : ""}`}
                onClick={() => handleDriverClick(driver)}
              >
                <span
                  className="w-2 h-2"
                  style={{
                    backgroundColor: color,
                    boxShadow: isSelected ? `0 0 6px ${color}` : 'none'
                  }}
                />
                <span className="text-[9px] font-headline font-bold">{driver}</span>
              </div>
            );
          })}
        </div>

        <div className="flex-1 relative min-h-[200px] sm:min-h-[280px] min-w-0">
          {positionData.positionChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <LineChart data={positionData.positionChartData}>
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
                />
                <YAxis
                  stroke="#444"
                  tick={{ fill: "#555", fontSize: 9, fontFamily: "ui-monospace" }}
                  tickLine={{ stroke: "#333" }}
                  axisLine={{ stroke: "#333" }}
                  domain={[1, 10]}
                  reversed
                  tickFormatter={(v) => `P${v}`}
                  width={35}
                />
                <Tooltip content={<PositionTooltip />} />
                {positionData.topDrivers.slice(0, 8).map((driver, idx) => {
                  const isSelected = selectedDriver === driver;
                  const isFaded = selectedDriver && !isSelected;
                  const color = DRIVER_COLORS[driver] || LINE_COLORS[idx % LINE_COLORS.length];

                  return (
                    <Line
                      key={driver}
                      type="stepAfter"
                      dataKey={driver}
                      stroke={color}
                      dot={false}
                      strokeWidth={isSelected ? 3 : isFaded ? 1 : 2}
                      strokeOpacity={isFaded ? 0.2 : 1}
                      style={{
                        filter: isSelected ? `drop-shadow(0 0 4px ${color})` : 'none'
                      }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-stone-600 text-[10px] font-mono">
              NO POSITION DATA AVAILABLE
            </div>
          )}
        </div>
      </div>

      {/* Interval Gaps Visual & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Visual Gap Bars */}
        <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="chart-title text-[11px]">Interval Gaps</h2>
              <p className="chart-subtitle mt-0.5">Final race intervals</p>
            </div>
            <div className="mode-toggle">
              <button
                onClick={() => setCompareMode("leader")}
                className={`mode-toggle-btn ${compareMode === "leader" ? "active" : ""}`}
              >
                Leader
              </button>
              <button
                onClick={() => setCompareMode("ahead")}
                className={`mode-toggle-btn ${compareMode === "ahead" ? "active" : ""}`}
              >
                Ahead
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {intervalGaps.slice(0, 15).map((driver, idx) => {
              const gap = compareMode === "leader" ? driver.gap_to_leader : driver.gap_to_ahead;
              const maxGap = compareMode === "leader" ? Math.max(kpis.lastPlaceGap, 60) : 30;
              const barWidth = maxGap > 0 ? Math.min((gap / maxGap) * 100, 100) : 0;

              return (
                <div key={driver.driver_code} className="flex items-center gap-3 hover-lift transition-all duration-200">
                  <div className="w-6 text-right">
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        idx === 0 ? "text-yellow-500" : idx < 3 ? "text-stone-300" : "text-stone-500"
                      }`}
                    >
                      P{driver.position}
                    </span>
                  </div>
                  <div
                    className="w-1 h-5"
                    style={{ backgroundColor: DRIVER_COLORS[driver.driver_code] || "#666" }}
                  />
                  <div className="w-10">
                    <span className="text-[10px] font-headline font-bold text-white">{driver.driver_code}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    {idx === 0 && compareMode === "leader" ? (
                      <div className="flex-1 h-5 bg-yellow-500/20 flex items-center px-2">
                        <span className="text-[9px] font-headline font-bold text-yellow-500 uppercase tracking-wider">Leader</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 h-5 bg-stone-900/50 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-container/60 to-primary-container/30 transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="w-16 text-right">
                          <span className="text-[9px] font-mono text-stone-400">
                            +{gap.toFixed(3)}s
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gap Details Table */}
        <div className="bg-surface border border-stone-800">
          <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
            <h2 className="chart-title text-[11px]">Gap Details</h2>
            <span className="text-[7px] font-mono text-stone-600">[FINISH_ORDER]</span>
          </div>
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-headline font-bold tracking-widest bg-stone-950">
                  <th className="px-4 py-3 font-medium">Pos</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium text-right">To Leader</th>
                  <th className="px-4 py-3 font-medium text-right">Interval</th>
                </tr>
              </thead>
              <tbody className="text-[9px] font-mono">
                {intervalGaps.map((driver, idx) => (
                  <tr
                    key={driver.driver_code}
                    className={`border-b border-stone-800/50 hover:bg-white/5 transition-colors ${
                      idx === 0 ? "bg-yellow-500/5" : ""
                    }`}
                  >
                    <td
                      className={`px-4 py-2.5 font-black ${
                        idx === 0 ? "text-yellow-500" : "text-stone-300"
                      }`}
                    >
                      {driver.status !== "Finished" && driver.laps_completed < overview.metrics.total_laps ? "DNF" : String(driver.position).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-0.5 h-4"
                          style={{ backgroundColor: DRIVER_COLORS[driver.driver_code] || "#666" }}
                        />
                        <span className="text-white font-bold">{driver.driver_name}</span>
                      </div>
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right ${
                        idx === 0 ? "text-yellow-500" : "text-stone-400"
                      }`}
                    >
                      {idx === 0 ? "LEADER" : `+${driver.gap_to_leader.toFixed(3)}s`}
                    </td>
                    <td className="px-4 py-2.5 text-right text-primary-container">
                      {idx === 0 ? "--" : `+${driver.gap_to_ahead.toFixed(3)}s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Battle Zones */}
      <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="chart-title">Battle Zones</h2>
            <p className="chart-subtitle mt-0.5">Close fights at race end</p>
          </div>
          <span className="text-[7px] font-mono text-green-500 bg-green-500/10 px-2 py-1 border border-green-500/20">
            &lt; 3.0s GAP
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {intervalGaps
            .slice(1)
            .filter((d) => d.gap_to_ahead > 0 && d.gap_to_ahead < 3)
            .slice(0, 6)
            .map((driver) => {
              const ahead = intervalGaps.find((d) => d.position === driver.position - 1);
              if (!ahead) return null;

              const intensity = Math.max(0, 1 - driver.gap_to_ahead / 3);

              return (
                <div
                  key={driver.driver_code}
                  className="bg-stone-900/50 p-3 border border-stone-800 hover-lift transition-all duration-200"
                  style={{
                    borderColor: `rgba(34, 197, 94, ${intensity * 0.5 + 0.2})`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2"
                        style={{ backgroundColor: DRIVER_COLORS[ahead.driver_code] || "#666" }}
                      />
                      <span className="text-[10px] font-headline font-bold text-white uppercase">{ahead.driver_code}</span>
                    </div>
                    <span className="text-[9px] font-mono text-stone-500">P{ahead.position}</span>
                  </div>

                  <div className="flex items-center justify-center py-2">
                    <div className="flex-1 h-0.5 bg-stone-700" />
                    <div className="px-3">
                      <span
                        className="text-sm font-display font-black"
                        style={{
                          color: `rgb(${Math.floor(34 + intensity * 200)}, ${Math.floor(197 - intensity * 100)}, ${Math.floor(94 - intensity * 50)})`,
                        }}
                      >
                        +{driver.gap_to_ahead.toFixed(3)}s
                      </span>
                    </div>
                    <div className="flex-1 h-0.5 bg-stone-700" />
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[9px] font-mono text-stone-500">P{driver.position}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-headline font-bold text-white uppercase">{driver.driver_code}</span>
                      <div
                        className="w-2 h-2"
                        style={{ backgroundColor: DRIVER_COLORS[driver.driver_code] || "#666" }}
                      />
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-stone-800">
                    <div className="flex justify-between text-[8px] font-mono text-stone-500">
                      <span>DRS RANGE</span>
                      <span
                        className={
                          driver.gap_to_ahead <= 1
                            ? "text-green-500 font-bold"
                            : "text-stone-600"
                        }
                      >
                        {driver.gap_to_ahead <= 1 ? "IN ZONE" : "OUT"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {intervalGaps.slice(1).filter((d) => d.gap_to_ahead > 0 && d.gap_to_ahead < 3).length === 0 && (
          <div className="text-center py-8 text-stone-600 text-[10px] font-mono">
            NO CLOSE BATTLES DETECTED IN FINAL STANDINGS
          </div>
        )}
      </div>
    </div>
  );
}

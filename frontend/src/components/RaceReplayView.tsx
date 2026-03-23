"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface RaceReplayViewProps {
  overview: RaceOverview;
}

type PlaybackSpeed = 0.5 | 1 | 2 | 4;

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

const formatLapTime = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, "0")}`;
};

export default function RaceReplayView({ overview }: RaceReplayViewProps) {
  const [currentLap, setCurrentLap] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const totalLaps = overview.metrics.total_laps || 57;
  const hasLapData = overview.lap_times.length > 0;

  // Get sorted race results
  const sortedResults = useMemo(() => {
    return overview.race_results.slice().sort((a, b) => a.position - b.position);
  }, [overview.race_results]);

  // Calculate positions at current lap
  const currentPositions = useMemo(() => {
    if (!hasLapData) {
      // Fallback: use final race positions with simulated gaps
      return sortedResults.map((driver, idx) => ({
        position: driver.position,
        driver_code: driver.driver_code,
        driver_name: driver.driver_name,
        lap_time: overview.metrics.avg_lap_time_seconds || 90,
        cumulative: (overview.metrics.avg_lap_time_seconds || 90) * currentLap + idx * 2,
        gap_to_leader: idx === 0 ? 0 : (driver.time_diff_seconds ?? idx * 5),
      }));
    }

    // Build cumulative times for each driver up to current lap
    const driverData: Record<string, { time: number; cumulative: number }> = {};

    for (const driver of sortedResults) {
      const driverLaps = overview.lap_times
        .filter((l) => l.driver_code === driver.driver_code && l.lap_number <= currentLap)
        .sort((a, b) => a.lap_number - b.lap_number);

      if (driverLaps.length > 0) {
        const currentLapEntry = driverLaps.find((l) => l.lap_number === currentLap);
        const cumulative = driverLaps.reduce((sum, l) => sum + l.lap_time_seconds, 0);
        driverData[driver.driver_code] = {
          time: currentLapEntry?.lap_time_seconds ?? driverLaps[driverLaps.length - 1]?.lap_time_seconds ?? 0,
          cumulative,
        };
      }
    }

    const entries = Object.entries(driverData)
      .filter(([, data]) => data.cumulative > 0)
      .sort((a, b) => a[1].cumulative - b[1].cumulative);

    if (entries.length === 0) {
      // Still no data, use race results
      return sortedResults.map((driver, idx) => ({
        position: driver.position,
        driver_code: driver.driver_code,
        driver_name: driver.driver_name,
        lap_time: overview.metrics.avg_lap_time_seconds || 90,
        cumulative: 0,
        gap_to_leader: driver.time_diff_seconds ?? 0,
      }));
    }

    const leaderTime = entries[0]?.[1].cumulative ?? 0;

    return entries.map(([code, data], idx) => ({
      position: idx + 1,
      driver_code: code,
      driver_name: sortedResults.find((r) => r.driver_code === code)?.driver_name ?? code,
      lap_time: data.time,
      cumulative: data.cumulative,
      gap_to_leader: data.cumulative - leaderTime,
    }));
  }, [overview, currentLap, hasLapData, sortedResults]);

  // Get lap time progression data for chart
  const lapChartData = useMemo(() => {
    const topDrivers = sortedResults.slice(0, 4).map((r) => r.driver_code);

    if (!hasLapData) {
      // Generate simulated data based on average lap time
      const avgLap = overview.metrics.avg_lap_time_seconds || 90;
      const data: Record<string, number | string>[] = [];
      for (let lap = 1; lap <= Math.min(currentLap, totalLaps); lap++) {
        const entry: Record<string, number | string> = { lap };
        topDrivers.forEach((driver, idx) => {
          // Add slight variation
          entry[driver] = avgLap + (Math.sin(lap * 0.5 + idx) * 0.5);
        });
        data.push(entry);
      }
      return { data, drivers: topDrivers };
    }

    const data: Record<string, number | string>[] = [];

    for (let lap = 1; lap <= Math.min(currentLap, totalLaps); lap++) {
      const entry: Record<string, number | string> = { lap };
      let hasData = false;
      for (const driver of topDrivers) {
        const lapEntry = overview.lap_times.find(
          (l) => l.driver_code === driver && l.lap_number === lap
        );
        if (lapEntry) {
          entry[driver] = lapEntry.lap_time_seconds;
          hasData = true;
        }
      }
      if (hasData) {
        data.push(entry);
      }
    }

    return { data, drivers: topDrivers };
  }, [overview, currentLap, totalLaps, hasLapData, sortedResults]);

  // Playback controls
  const play = useCallback(() => {
    if (currentLap >= totalLaps) {
      setCurrentLap(1);
    }
    setIsPlaying(true);
  }, [currentLap, totalLaps]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentLap(1);
  }, []);

  const skipForward = useCallback(() => {
    setCurrentLap((prev) => Math.min(prev + 5, totalLaps));
  }, [totalLaps]);

  const skipBackward = useCallback(() => {
    setCurrentLap((prev) => Math.max(prev - 5, 1));
  }, []);

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentLap((prev) => {
          if (prev >= totalLaps) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, totalLaps]);

  // Get pit stops that happened on current lap
  const currentPitStops = useMemo(() => {
    return overview.pit_strategies.filter((p) => p.lap_number === currentLap);
  }, [overview.pit_strategies, currentLap]);

  return (
    <div className="space-y-4">
      {/* Replay Controls */}
      <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={reset}
                className="w-10 h-10 flex items-center justify-center bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors"
                title="Reset"
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              </button>
              <button
                onClick={skipBackward}
                className="w-10 h-10 flex items-center justify-center bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors"
                title="Skip back 5 laps"
              >
                <span className="material-symbols-outlined text-[18px]">fast_rewind</span>
              </button>
              <button
                onClick={isPlaying ? pause : play}
                className={`w-12 h-12 flex items-center justify-center transition-colors ${
                  isPlaying
                    ? "bg-primary-container text-white hover:bg-red-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
                title={isPlaying ? "Pause" : "Play"}
              >
                <span className="material-symbols-outlined text-[24px]">
                  {isPlaying ? "pause" : "play_arrow"}
                </span>
              </button>
              <button
                onClick={skipForward}
                className="w-10 h-10 flex items-center justify-center bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors"
                title="Skip forward 5 laps"
              >
                <span className="material-symbols-outlined text-[18px]">fast_forward</span>
              </button>
            </div>

            <div className="flex items-center gap-2 border-l border-stone-700 pl-4">
              <span className="text-[8px] font-mono text-stone-500 uppercase">Speed:</span>
              {([0.5, 1, 2, 4] as PlaybackSpeed[]).map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-1 text-[10px] font-mono font-bold transition-colors ${
                    playbackSpeed === speed
                      ? "bg-primary-container text-white"
                      : "bg-stone-800 text-stone-400 hover:text-white"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-stone-500 uppercase">Lap:</span>
              <span className="text-2xl font-headline font-black text-primary-container">
                {String(currentLap).padStart(2, "0")}
              </span>
              <span className="text-stone-500 text-lg font-mono">/</span>
              <span className="text-lg font-mono text-stone-400">{totalLaps}</span>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-1 ${
                isPlaying ? "bg-green-500/20" : "bg-stone-800"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isPlaying ? "bg-green-500 animate-pulse" : "bg-stone-600"
                }`}
              />
              <span
                className={`text-[9px] font-mono font-bold uppercase ${
                  isPlaying ? "text-green-500" : "text-stone-500"
                }`}
              >
                {isPlaying ? "LIVE" : "PAUSED"}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div
            className="relative h-2 bg-stone-900 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percentage = (e.clientX - rect.left) / rect.width;
              setCurrentLap(Math.max(1, Math.min(totalLaps, Math.round(percentage * totalLaps))));
            }}
          >
            <div
              className="absolute h-full bg-gradient-to-r from-primary-container to-red-400 transition-all duration-200"
              style={{ width: `${(currentLap / totalLaps) * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg cursor-grab transition-all duration-200"
              style={{ left: `calc(${(currentLap / totalLaps) * 100}% - 8px)` }}
            />
          </div>
          <div className="flex justify-between text-[8px] font-mono text-stone-600 mt-1">
            <span>LAP 1</span>
            <span>LAP {Math.floor(totalLaps / 2)}</span>
            <span>LAP {totalLaps}</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Track Visualization */}
        <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
              Track Position
            </span>
            <span className="text-[7px] font-mono text-green-500 bg-green-500/10 px-1 border border-green-500/20">
              LAP {currentLap}
            </span>
          </div>

          {/* Simplified track representation */}
          <div className="relative h-64 w-full">
            <svg className="w-full h-full" viewBox="0 0 200 200">
              {/* Track outline */}
              <path
                className="stroke-stone-600 stroke-[8]"
                d="M40 160 Q20 160 20 140 L20 60 Q20 40 40 40 L160 40 Q180 40 180 60 L180 100 Q180 120 160 120 L100 120 Q80 120 80 140 L80 160 Q80 180 60 180 L40 180 Q20 180 20 160 Z"
                fill="none"
                strokeLinecap="round"
              />
              {/* Track surface */}
              <path
                className="stroke-stone-700 stroke-[4]"
                d="M40 160 Q20 160 20 140 L20 60 Q20 40 40 40 L160 40 Q180 40 180 60 L180 100 Q180 120 160 120 L100 120 Q80 120 80 140 L80 160 Q80 180 60 180 L40 180 Q20 180 20 160 Z"
                fill="none"
                strokeLinecap="round"
              />

              {/* Driver positions on track */}
              {currentPositions.slice(0, 10).map((driver, idx) => {
                // Calculate position along track path
                const total = Math.min(currentPositions.length, 10);
                const progress = 1 - idx / Math.max(total - 1, 1);
                const angle = progress * Math.PI * 2 - Math.PI / 2;
                const cx = 100 + Math.cos(angle) * 60;
                const cy = 100 + Math.sin(angle) * 50;

                return (
                  <g key={driver.driver_code}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="8"
                      fill={DRIVER_COLORS[driver.driver_code] || "#666"}
                      className="transition-all duration-300"
                    />
                    <text
                      x={cx}
                      y={cy + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-white text-[6px] font-bold"
                    >
                      {driver.position}
                    </text>
                  </g>
                );
              })}

              {/* Start/Finish line */}
              <line x1="40" y1="175" x2="40" y2="185" className="stroke-white stroke-2" />
              <text x="45" y="182" className="fill-stone-500 text-[6px]">S/F</text>
            </svg>
          </div>

          {/* Position legend */}
          <div className="mt-4 grid grid-cols-5 gap-1">
            {currentPositions.slice(0, 10).map((driver) => (
              <div key={driver.driver_code} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: DRIVER_COLORS[driver.driver_code] || "#666" }}
                />
                <span className="text-[8px] font-mono text-stone-400">{driver.driver_code}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Standings */}
        <div className="bg-surface border border-stone-800 lg:col-span-2">
          <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
            <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em]">
              Live Standings
            </h2>
            <span className="text-[7px] font-mono text-stone-600">[LAP_{currentLap}]</span>
          </div>
          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-bold tracking-widest bg-stone-950">
                  <th className="px-4 py-2 font-medium">Pos</th>
                  <th className="px-4 py-2 font-medium">Driver</th>
                  <th className="px-4 py-2 font-medium text-right">Lap Time</th>
                  <th className="px-4 py-2 font-medium text-right">Gap</th>
                </tr>
              </thead>
              <tbody className="text-[9px] font-mono">
                {currentPositions.map((driver, idx) => (
                  <tr
                    key={driver.driver_code}
                    className={`border-b border-stone-800/50 transition-all duration-300 ${
                      idx === 0 ? "bg-yellow-500/10" : ""
                    }`}
                  >
                    <td
                      className={`px-4 py-2 font-black ${
                        idx === 0 ? "text-yellow-500" : idx < 3 ? "text-stone-200" : "text-stone-400"
                      }`}
                    >
                      P{driver.position}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-0.5 h-4"
                          style={{ backgroundColor: DRIVER_COLORS[driver.driver_code] || "#666" }}
                        />
                        <span className="text-white font-bold">{driver.driver_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-stone-400">
                      {formatLapTime(driver.lap_time)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${
                        idx === 0 ? "text-yellow-500" : "text-primary-container"
                      }`}
                    >
                      {idx === 0 ? "LEADER" : `+${driver.gap_to_leader.toFixed(3)}s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lap Time Chart */}
      <div className="bg-surface-container border border-stone-800 p-4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
              Lap Time Progression
              <span className="text-[8px] font-mono text-stone-600 font-normal">LIVE_UPDATE</span>
            </h2>
          </div>
          <div className="flex gap-3">
            {lapChartData.drivers.map((driver, idx) => (
              <div key={driver} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-0.5"
                  style={{ backgroundColor: DRIVER_COLORS[driver] || `hsl(${idx * 60}, 70%, 50%)` }}
                />
                <span className="text-[9px] font-bold font-mono">{driver}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 relative min-h-[200px]">
          {lapChartData.data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lapChartData.data}>
                <CartesianGrid strokeDasharray="2 2" stroke="#333" />
                <XAxis
                  dataKey="lap"
                  stroke="#666"
                  tick={{ fill: "#666", fontSize: 10 }}
                  tickLine={{ stroke: "#333" }}
                  domain={[1, totalLaps]}
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
                {lapChartData.drivers.map((driver, idx) => (
                  <Line
                    key={driver}
                    type="monotone"
                    dataKey={driver}
                    stroke={DRIVER_COLORS[driver] || `hsl(${idx * 60}, 70%, 50%)`}
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-stone-600 text-[10px] font-mono">
              PRESS PLAY TO START REPLAY
            </div>
          )}
        </div>
      </div>

      {/* Events Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pit Stops This Lap */}
        <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
              Pit Activity
            </span>
            <span className="text-[7px] font-mono text-yellow-500">[LAP_{currentLap}]</span>
          </div>

          {currentPitStops.length > 0 ? (
            <div className="space-y-2">
              {currentPitStops.map((pit, idx) => (
                <div
                  key={`${pit.driver_code}-${idx}`}
                  className="flex items-center gap-3 p-2 bg-stone-900/50 border-l-2"
                  style={{ borderColor: DRIVER_COLORS[pit.driver_code] || "#666" }}
                >
                  <span className="material-symbols-outlined text-yellow-500 text-lg">
                    build
                  </span>
                  <div className="flex-1">
                    <div className="text-[10px] font-mono font-bold text-white">
                      {pit.driver_name}
                    </div>
                    <div className="text-[8px] font-mono text-stone-500">
                      PIT IN → {pit.compound}
                    </div>
                  </div>
                  <div
                    className="px-2 py-0.5 text-[8px] font-bold uppercase"
                    style={{
                      backgroundColor:
                        pit.compound === "SOFT"
                          ? "#e10600"
                          : pit.compound === "MEDIUM"
                          ? "#fcd34d"
                          : pit.compound === "HARD"
                          ? "#f5f5f5"
                          : "#666",
                      color: pit.compound === "HARD" || pit.compound === "MEDIUM" ? "#000" : "#fff",
                    }}
                  >
                    {pit.compound.charAt(0)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-stone-600 text-[10px] font-mono">
              NO PIT ACTIVITY THIS LAP
            </div>
          )}
        </div>

        {/* Race Stats */}
        <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
              Race Status
            </span>
            <span className="text-[7px] font-mono text-stone-600">[STATS]</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-900/50 p-3 text-center">
              <div className="text-[7px] uppercase text-stone-600 mb-1">Progress</div>
              <div className="text-lg font-headline font-black text-primary-container">
                {Math.round((currentLap / totalLaps) * 100)}%
              </div>
            </div>
            <div className="bg-stone-900/50 p-3 text-center">
              <div className="text-[7px] uppercase text-stone-600 mb-1">Remaining</div>
              <div className="text-lg font-headline font-black text-on-surface">
                {totalLaps - currentLap}
              </div>
            </div>
            <div className="bg-stone-900/50 p-3 text-center">
              <div className="text-[7px] uppercase text-stone-600 mb-1">Leader</div>
              <div className="text-lg font-headline font-black text-yellow-500">
                {currentPositions[0]?.driver_code || "--"}
              </div>
            </div>
            <div className="bg-stone-900/50 p-3 text-center">
              <div className="text-[7px] uppercase text-stone-600 mb-1">Gap P1-P2</div>
              <div className="text-sm font-headline font-black text-on-surface">
                {currentPositions[1]
                  ? `+${currentPositions[1].gap_to_leader.toFixed(1)}s`
                  : "--"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RaceOverview } from "@/lib/api";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RaceReplayViewProps {
  overview: RaceOverview;
}

type PlaybackSpeed = 0.5 | 1 | 2 | 4;
type ChartMode = "absolute" | "delta";

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

type TrackMarker = {
  driver_code: string;
  position: number;
  x: number;
  y: number;
};

function getAdjustedCoordinates(drivers: TrackMarker[], minDistance = 28): TrackMarker[] {
  const adjusted = drivers.map((marker) => ({ ...marker }));
  const iterations = 10;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let i = 0; i < adjusted.length; i += 1) {
      for (let j = i + 1; j < adjusted.length; j += 1) {
        const a = adjusted[i];
        const b = adjusted[j];

        let dx = a.x - b.x;
        let dy = a.y - b.y;

        // Jitter if directly on top of each other (deterministic to avoid wiggling each frame)
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
          dx = (a.position - b.position) * 0.1 || 0.1;
          dy = (a.position - b.position) * 0.1 || 0.1;
        }

        const distance = Math.hypot(dx, dy);

        if (distance >= minDistance) continue;

        const safeDistance = distance < 0.001 ? 0.001 : distance;
        const overlap = minDistance - safeDistance;
        const ux = dx / safeDistance;
        const uy = dy / safeDistance;
        const moveX = ux * overlap * 0.6;
        const moveY = uy * overlap * 0.6;

        // Nudge the trailing car more than the leading car to preserve race order clarity.
        if (a.position > b.position) {
          a.x += moveX;
          a.y += moveY;
          b.x -= moveX * 0.15;
          b.y -= moveY * 0.15;
        } else {
          b.x -= moveX;
          b.y -= moveY;
          a.x += moveX * 0.15;
          a.y += moveY * 0.15;
        }
      }
    }

    // Keep markers inside bounds
    for (const marker of adjusted) {
      marker.x = Math.max(10, Math.min(490, marker.x));
      marker.y = Math.max(10, Math.min(490, marker.y));
    }
  }

  // Z-Index Sorting: Sort by position descending (P20 first, P1 last) so P1 appears on top
  return adjusted.sort((a, b) => b.position - a.position);
}

const BAHRAIN_LAYOUT_SVG_URL =
  "https://raw.githubusercontent.com/julesr0y/f1-circuits-svg/main/circuits/white-outline/bahrain-1.svg";

const formatLapTime = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "--";
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
  chartMode: ChartMode;
  leaderTime?: number;
}

const CustomChartTooltip = ({ active, payload, label, chartMode, leaderTime }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const sortedPayload = [...payload].sort((a, b) => {
    if (chartMode === "delta") {
      return a.value - b.value;
    }
    return a.value - b.value;
  });

  return (
    <div className="f1-tooltip" style={{ minWidth: 180 }}>
      <div className="f1-tooltip-label">LAP {label}</div>
      <div className="space-y-1">
        {sortedPayload.map((entry, idx) => {
          const delta = leaderTime ? entry.value - leaderTime : 0;
          return (
            <div key={entry.dataKey} className="f1-tooltip-item">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="f1-tooltip-driver">{entry.dataKey}</span>
                {idx === 0 && chartMode === "absolute" && (
                  <span className="text-[8px] text-yellow-500 font-bold">LEADER</span>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className="f1-tooltip-time">
                  {chartMode === "absolute"
                    ? formatLapTime(entry.value)
                    : formatDelta(entry.value)
                  }
                </span>
                {chartMode === "absolute" && idx > 0 && (
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

export default function RaceReplayView({ overview }: RaceReplayViewProps) {
  const [currentLap, setCurrentLap] = useState(1);
  const [lapPhase, setLapPhase] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [chartMode, setChartMode] = useState<ChartMode>("absolute");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [bahrainPathD, setBahrainPathD] = useState<string>("");
  const [trackPathLength, setTrackPathLength] = useState(0);
  const trackPathRef = useRef<SVGPathElement | null>(null);

  // New UI states
  const [showLabels, setShowLabels] = useState(true);
  const [showProgress, setShowProgress] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  const totalLaps = Math.max(1, overview.metrics?.total_laps || 57);
  const hasLapData = overview.lap_times && overview.lap_times.length > 0;       

  useEffect(() => {
    let isActive = true;

    const loadBahrainLayout = async () => {
      try {
        const response = await fetch(BAHRAIN_LAYOUT_SVG_URL, { cache: "force-cache" });
        if (!response.ok) return;

        const svgText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const firstPath = doc.querySelector("path");
        const pathD = firstPath?.getAttribute("d");

        if (isActive && pathD) {
          setBahrainPathD(pathD);
        }
      } catch {
        // Keep fallback drawing if remote layout cannot be fetched.
      }
    };

    void loadBahrainLayout();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!trackPathRef.current) return;

    try {
      const nextLength = trackPathRef.current.getTotalLength();
      if (Number.isFinite(nextLength) && nextLength > 0) {
        setTrackPathLength(nextLength);
      }
    } catch {
      setTrackPathLength(0);
    }
  }, [bahrainPathD]);

  // Get sorted race results
  const sortedResults = useMemo(() => {
    const valid = overview.race_results
      .filter((r) => r.driver_code)
      .slice();

    return valid.sort((a, b) => {
      const aPos = Number.isFinite(a.position) ? a.position : Number.MAX_SAFE_INTEGER;
      const bPos = Number.isFinite(b.position) ? b.position : Number.MAX_SAFE_INTEGER;
      return aPos - bPos;
    });
  }, [overview.race_results]);

  const fallbackDriversFromLaps = useMemo(() => {
    const seen = new Set<string>();
    const drivers: Array<{ driver_code: string; driver_name: string }> = [];

    for (const lap of overview.lap_times) {
      if (!lap.driver_code || seen.has(lap.driver_code)) continue;
      seen.add(lap.driver_code);
      drivers.push({ driver_code: lap.driver_code, driver_name: lap.driver_name || lap.driver_code });
    }

    return drivers;
  }, [overview.lap_times]);

  const buildPositionsAtLap = useCallback((targetLap: number) => {
    if (!hasLapData && sortedResults.length > 0) {
      return sortedResults.map((driver, idx) => ({
        position: driver.position,
        driver_code: driver.driver_code,
        driver_name: driver.driver_name,
        lap_time: 0,
        cumulative: 0,
        gap_to_leader: idx === 0 ? 0 : (driver.time_diff_seconds ?? 0),
      }));
    }

    const candidateDrivers =
      sortedResults.length > 0
        ? sortedResults.map((d) => ({ driver_code: d.driver_code, driver_name: d.driver_name }))
        : fallbackDriversFromLaps;

    const driverData: Record<string, { time: number; cumulative: number }> = {};

    for (const driver of candidateDrivers) {
      const driverLaps = overview.lap_times
        .filter((l) => l.driver_code === driver.driver_code && l.lap_number <= targetLap)
        .sort((a, b) => a.lap_number - b.lap_number);

      if (driverLaps.length > 0) {
        const currentLapEntry = driverLaps.find((l) => l.lap_number === targetLap);
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
      return sortedResults.map((driver, idx) => ({
        position: driver.position,
        driver_code: driver.driver_code,
        driver_name: driver.driver_name,
        lap_time: 0,
        cumulative: 0,
        gap_to_leader: idx === 0 ? 0 : (driver.time_diff_seconds ?? 0),
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
  }, [hasLapData, sortedResults, fallbackDriversFromLaps, overview.lap_times]);

  // Calculate positions at current lap
  const currentPositions = useMemo(() => {
    return buildPositionsAtLap(currentLap);
  }, [buildPositionsAtLap, currentLap]);

  const nextLapPositions = useMemo(() => {
    return buildPositionsAtLap(Math.min(currentLap + 1, totalLaps));
  }, [buildPositionsAtLap, currentLap, totalLaps]);

  // Get lap time progression data for chart
  const lapChartData = useMemo(() => {
    const topDrivers =
      sortedResults.length > 0
        ? sortedResults.slice(0, 6).map((r) => r.driver_code)
        : fallbackDriversFromLaps.slice(0, 6).map((d) => d.driver_code);

    if (!hasLapData) {
      return { data: [], drivers: topDrivers, leaderTimes: {} };
    }

    const data: Record<string, number | string>[] = [];
    const leaderTimes: Record<number, number> = {};

    for (let lap = 1; lap <= Math.min(currentLap, totalLaps); lap++) {
      const entry: Record<string, number | string> = { lap };
      let hasData = false;
      let minTime = Infinity;

      // First pass: collect absolute times and find leader
      for (const driver of topDrivers) {
        const lapEntry = overview.lap_times.find(
          (l) => l.driver_code === driver && l.lap_number === lap
        );
        if (lapEntry) {
          entry[`${driver}_abs`] = lapEntry.lap_time_seconds;
          if (lapEntry.lap_time_seconds < minTime) {
            minTime = lapEntry.lap_time_seconds;
          }
          hasData = true;
        }
      }

      leaderTimes[lap] = minTime;

      // Calculate based on mode
      if (chartMode === "absolute") {
        for (const driver of topDrivers) {
          const absKey = `${driver}_abs`;
          if (entry[absKey] !== undefined) {
            entry[driver] = entry[absKey];
          }
        }
      } else {
        // Delta mode
        for (const driver of topDrivers) {
          const absKey = `${driver}_abs`;
          if (entry[absKey] !== undefined) {
            entry[driver] = (entry[absKey] as number) - minTime;
          }
        }
      }

      if (hasData) {
        data.push(entry);
      }
    }

    return { data, drivers: topDrivers, leaderTimes };
  }, [overview, currentLap, totalLaps, hasLapData, sortedResults, fallbackDriversFromLaps, chartMode]);

  // Calculate insights
  const insights = useMemo(() => {
    if (!hasLapData || currentPositions.length === 0) {
      return {
        leader: "--",
        consistency: "N/A",
        degradation: "N/A",
        trend: "N/A",
        fastestLap: null as { driver: string; time: number; lap: number } | null,
      };
    }

    const leader = currentPositions[0]?.driver_code || "--";

    // Calculate consistency (standard deviation of lap times)
    const leaderLaps = overview.lap_times
      .filter((l) => l.driver_code === leader && l.lap_number <= currentLap)
      .map((l) => l.lap_time_seconds)
      .filter((t) => t > 0);

    let consistency = "N/A";
    if (leaderLaps.length > 3) {
      const avg = leaderLaps.reduce((a, b) => a + b, 0) / leaderLaps.length;
      const variance = leaderLaps.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / leaderLaps.length;
      const stdDev = Math.sqrt(variance);
      consistency = stdDev < 0.5 ? "HIGH" : stdDev < 1 ? "MEDIUM" : "LOW";
    }

    // Calculate degradation trend
    let degradation = "N/A";
    if (leaderLaps.length > 5) {
      const firstHalf = leaderLaps.slice(0, Math.floor(leaderLaps.length / 2));
      const secondHalf = leaderLaps.slice(Math.floor(leaderLaps.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const diff = secondAvg - firstAvg;
      degradation = diff > 0.5 ? "HIGH" : diff > 0.2 ? "MEDIUM" : "LOW";
    }

    // Calculate trend
    let trend = "N/A";
    if (leaderLaps.length > 3) {
      const recent = leaderLaps.slice(-3);
      const earlier = leaderLaps.slice(-6, -3);
      if (earlier.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
        trend = recentAvg < earlierAvg ? "IMPROVING" : recentAvg > earlierAvg + 0.3 ? "DEGRADING" : "STABLE";
      }
    }

    // Find fastest lap so far
    let fastestLap: { driver: string; time: number; lap: number } | null = null;
    for (const lap of overview.lap_times) {
      if (lap.lap_number <= currentLap && lap.lap_time_seconds > 0) {
        if (!fastestLap || lap.lap_time_seconds < fastestLap.time) {
          fastestLap = {
            driver: lap.driver_code,
            time: lap.lap_time_seconds,
            lap: lap.lap_number,
          };
        }
      }
    }

    return { leader, consistency, degradation, trend, fastestLap };
  }, [overview.lap_times, currentLap, hasLapData, currentPositions]);

  // Driver click handler for legend
  const handleDriverClick = useCallback((driver: string) => {
    setSelectedDriver((prev) => (prev === driver ? null : driver));
  }, []);

  // Playback controls
  const play = useCallback(() => {
    if (currentLap >= totalLaps) {
      setCurrentLap(1);
      setLapPhase(0);
    }
    setIsPlaying(true);
  }, [currentLap, totalLaps]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentLap(1);
    setLapPhase(0);
  }, []);

  const skipForward = useCallback(() => {
    setCurrentLap((prev) => Math.min(prev + 5, totalLaps));
    setLapPhase(0);
  }, [totalLaps]);

  const skipBackward = useCallback(() => {
    setCurrentLap((prev) => Math.max(prev - 5, 1));
    setLapPhase(0);
  }, []);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let frameId = 0;
    let lastTimestamp = performance.now();

    const animate = (now: number) => {
      const deltaSeconds = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      setLapPhase((prevPhase) => {
        let nextPhase = prevPhase + deltaSeconds * playbackSpeed;

        if (nextPhase >= 1) {
          const lapSteps = Math.floor(nextPhase);
          nextPhase -= lapSteps;

          setCurrentLap((prevLap) => {
            const targetLap = prevLap + lapSteps;
            if (targetLap >= totalLaps) {
              setIsPlaying(false);
              return totalLaps;
            }
            return targetLap;
          });
        }

        return nextPhase;
      });

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isPlaying, playbackSpeed, totalLaps]);

  // Get pit stops that happened on current lap
  const currentPitStops = useMemo(() => {
    return overview.pit_strategies.filter((p) => p.lap_number === currentLap);
  }, [overview.pit_strategies, currentLap]);

  const driverProgressByCode = useMemo(() => {
    const progressMap = new Map<string, number>();
    if (currentPositions.length === 0) return progressMap;

    const nextGapByCode = new Map(
      nextLapPositions.map((driver) => [driver.driver_code, Math.max(0, driver.gap_to_leader ?? 0)]),
    );

    const maxCurrentGap = Math.max(
      ...currentPositions.map((driver) => Math.max(0, driver.gap_to_leader ?? 0)),
      1,
    );
    const maxNextGap = Math.max(...nextLapPositions.map((driver) => Math.max(0, driver.gap_to_leader ?? 0)), 1);
    const maxGap = Math.max(maxCurrentGap, maxNextGap, 1);
    const fieldSize = Math.max(currentPositions.length - 1, 1);

    currentPositions.forEach((driver, idx) => {
      // Normalize by field spread so drivers are distributed along the full circuit.
      const currentGap = Math.max(0, driver.gap_to_leader ?? 0);
      const nextGap = nextGapByCode.get(driver.driver_code) ?? currentGap;
      const gap = currentGap + (nextGap - currentGap) * lapPhase;
      const normalizedGap = hasLapData ? Math.min(1, gap / maxGap) : idx / fieldSize;
      const rankOffset = (idx / fieldSize) * 0.02;
      const progress = Math.max(0.01, Math.min(0.99, 0.98 - normalizedGap * 0.9 - rankOffset));
      progressMap.set(driver.driver_code, progress);
    });

    return progressMap;
  }, [currentPositions, nextLapPositions, lapPhase, hasLapData]);

  const trackMarkers = useMemo(() => {
    const baseMarkers = currentPositions.slice(0, 12).map((driver, idx) => {
      const fallbackProgress =
        currentPositions.length > 1
          ? 0.98 - (idx / (currentPositions.length - 1)) * 0.9
          : 0.98;
      const progress = driverProgressByCode.get(driver.driver_code) ?? fallbackProgress;

      let x = 250;
      let y = 250;

      if (trackPathRef.current && trackPathLength > 0) {
        const point = trackPathRef.current.getPointAtLength(progress * trackPathLength);
        x = point.x;
        y = point.y;
      }

      return {
        driver_code: driver.driver_code,
        position: driver.position,
        x,
        y,
      };
    });

    return getAdjustedCoordinates(baseMarkers, 28);
  }, [currentPositions, driverProgressByCode, trackPathLength]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      switch (e.key.toLowerCase()) {
        case " ": // Space
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case "arrowleft":
          e.preventDefault();
          skipBackward();
          break;
        case "arrowright":
          e.preventDefault();
          skipForward();
          break;
        case "arrowup":
          e.preventDefault();
          setPlaybackSpeed((prev) => (prev === 0.5 ? 1 : prev === 1 ? 2 : prev === 2 ? 4 : 4));
          break;
        case "arrowdown":
          e.preventDefault();
          setPlaybackSpeed((prev) => (prev === 4 ? 2 : prev === 2 ? 1 : prev === 1 ? 0.5 : 0.5));
          break;
        case "1":
          setPlaybackSpeed(0.5);
          break;
        case "2":
          setPlaybackSpeed(1);
          break;
        case "3":
          setPlaybackSpeed(2);
          break;
        case "4":
          setPlaybackSpeed(4);
          break;
        case "r":
          reset();
          break;
        case "l":
          setShowLabels((prev) => !prev);
          break;
        case "b":
          setShowProgress((prev) => !prev);
          break;
        case "m":
          setShowLeaderboard((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [skipBackward, skipForward, reset]);

  return (
    <div className="space-y-4">
      {/* Replay Controls */}
      <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={reset}
                className="w-10 h-10 flex items-center justify-center bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-all duration-200"
                title="Reset"
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              </button>
              <button
                onClick={skipBackward}
                className="w-10 h-10 flex items-center justify-center bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-all duration-200"
                title="Skip back 5 laps"
              >
                <span className="material-symbols-outlined text-[18px]">fast_rewind</span>
              </button>
              <button
                onClick={isPlaying ? pause : play}
                className={`w-12 h-12 flex items-center justify-center transition-all duration-200 ${
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
                className="w-10 h-10 flex items-center justify-center bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-all duration-200"
                title="Skip forward 5 laps"
              >
                <span className="material-symbols-outlined text-[18px]">fast_forward</span>
              </button>
            </div>

            <div className="flex items-center gap-2 border-l border-stone-700 pl-4">
              <span className="text-[8px] font-headline font-bold text-stone-500 uppercase tracking-wider">Speed</span>
              {([0.5, 1, 2, 4] as PlaybackSpeed[]).map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-1 text-[10px] font-mono font-bold transition-all duration-200 ${
                    playbackSpeed === speed
                      ? "bg-primary-container text-white"
                      : "bg-stone-800 text-stone-400 hover:text-white"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 border-l border-stone-700 pl-4">
              <span className="text-[8px] font-headline font-bold text-stone-500 uppercase tracking-wider">HUD</span>
              <button
                onClick={() => setShowLabels(!showLabels)}
                className={`px-2 py-1 text-[10px] font-mono font-bold transition-all duration-200 ${
                  showLabels ? "bg-primary-container text-white" : "bg-stone-800 text-stone-400 hover:text-white"
                }`}
                title="Toggle Labels (L)"
              >
                LBL
              </button>
              <button
                onClick={() => setShowProgress(!showProgress)}
                className={`px-2 py-1 text-[10px] font-mono font-bold transition-all duration-200 ${
                  showProgress ? "bg-primary-container text-white" : "bg-stone-800 text-stone-400 hover:text-white"
                }`}
                title="Toggle Progress Bar (B)"
              >
                PRG
              </button>
              <button
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className={`px-2 py-1 text-[10px] font-mono font-bold transition-all duration-200 ${
                  showLeaderboard ? "bg-primary-container text-white" : "bg-stone-800 text-stone-400 hover:text-white"
                }`}
                title="Toggle Leaderboard (M)"
              >
                LDB
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-headline font-bold text-stone-500 uppercase tracking-wider">Lap</span>
              <span className="text-2xl font-display font-black text-primary-container">
                {String(currentLap).padStart(2, "0")}
              </span>
              <span className="text-stone-500 text-lg font-mono">/</span>
              <span className="text-lg font-mono text-stone-400">{totalLaps}</span>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-1 transition-all duration-300 ${
                isPlaying ? "bg-green-500/20" : "bg-stone-800"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isPlaying ? "bg-green-500 animate-pulse" : "bg-stone-600"
                }`}
              />
              <span
                className={`text-[9px] font-headline font-bold uppercase ${
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
            className="relative h-2 bg-stone-900 cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percentage = (e.clientX - rect.left) / rect.width;
              setCurrentLap(Math.max(1, Math.min(totalLaps, Math.round(percentage * totalLaps))));
              setLapPhase(0);
            }}
          >
            <div
              className="absolute h-full bg-gradient-to-r from-primary-container to-red-400 transition-all duration-200"
              style={{ width: `${(currentLap / totalLaps) * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white shadow-lg cursor-grab transition-all duration-200 group-hover:scale-110"
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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Track Visualization */}
        <div className="bg-surface-container border border-stone-800 p-4 instrument-border lg:col-span-3">
          <div className="flex justify-between items-center mb-4">
            <span className="chart-title text-[11px]">Track Position</span>
            <span className="text-[7px] font-mono text-green-500 bg-green-500/10 px-1 border border-green-500/20">
              LAP {currentLap}
            </span>
          </div>

          {/* Track SVG Container - Bahrain GP from f1-circuits-svg */}
          <div className="relative w-full overflow-hidden bg-stone-900" style={{ aspectRatio: "1273/900" }}>
            {/* Live Leaderboard Overlay */}
            {showLeaderboard && currentPositions.length > 0 && (
              <div className="absolute top-4 left-4 z-10 w-48 bg-stone-900/90 border border-stone-700 shadow-lg backdrop-blur-sm max-h-[85%] overflow-y-auto hidden md:block" style={{ scrollbarWidth: 'none' }}>
                <div className="sticky top-0 bg-stone-900/95 border-b border-stone-700 px-3 py-2 z-10 flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest font-black text-stone-300">Leaderboard</span>
                  <span className="text-[10px] font-mono text-stone-400">L {Math.floor(currentLap)}/{totalLaps}</span>
                </div>
                <div className="flex flex-col text-xs">
                  {currentPositions
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((pos) => {
                      const isActive = pos.driver_code === selectedDriver;
                      return (
                        <div
                          key={pos.driver_code}
                          onClick={() => handleDriverClick(pos.driver_code)}
                          className={`flex items-center gap-2 px-3 py-1.5 border-b border-stone-800/50 cursor-pointer transition-colors ${
                            isActive ? "bg-primary-container/20" : "hover:bg-stone-800/50"
                          }`}
                        >
                          <span className="font-mono text-stone-500 w-4 text-right">{pos.position}</span>
                          <div
                            className="w-1 h-3 rounded-full"
                            style={{ backgroundColor: DRIVER_COLORS[pos.driver_code] || "#666" }}
                          />
                          <span className={`font-black tracking-wide ${isActive ? "text-white" : "text-stone-300"}`}>
                            {pos.driver_code}
                          </span>
                          <span className="ml-auto font-mono text-[9px] text-stone-500">
                            {pos.position === 1 ? "Interval" : `+${pos.gap_to_leader.toFixed(1)}`}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* SVG Track Background */}
            <svg
              className="w-full h-full absolute inset-0"
              viewBox="0 0 500 500"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid meet"
              style={{ background: "#0a0a0a" }}
            >
              {/* Track gradient background */}
              <defs>
                <radialGradient id="track-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1a1a1a"/>
                  <stop offset="100%" stopColor="#0a0a0a"/>
                </radialGradient>
                <filter id="glow-replay" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <rect width="500" height="500" fill="url(#track-glow)"/>

              {bahrainPathD ? (
                <>
                  <path
                    d={bahrainPathD}
                    fill="none"
                    stroke="#3a3a3a"
                    strokeWidth="20"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity="0.45"
                  />
                  <path
                    ref={trackPathRef}
                    d={bahrainPathD}
                    fill="none"
                    stroke="#151515"
                    strokeWidth="5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity="0.95"
                  />
                </>
              ) : (
                <path
                  ref={trackPathRef}
                  d="M50 365 L190 120 L335 360 L460 290"
                  fill="none"
                  stroke="#3a3a3a"
                  strokeWidth="20"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity="0.45"
                />
              )}

              {/* Driver position markers */}
              {trackMarkers
                .slice()
                .sort((left, right) => right.position - left.position)
                .map((marker) => {
                  const driver = currentPositions.find((candidate) => candidate.driver_code === marker.driver_code);
                  if (!driver) return null;

                  const isSelected = selectedDriver === driver.driver_code;
                  const isFaded = selectedDriver && !isSelected;

                  return (
                    <g
                      key={driver.driver_code}
                      className="transition-all duration-300 cursor-pointer"
                      onClick={() => handleDriverClick(driver.driver_code)}
                      style={{ opacity: isFaded ? 0.3 : 1 }}
                    >
                      {/* Glow effect for selected */}
                      {isSelected && (
                        <circle
                          cx={marker.x}
                          cy={marker.y}
                          r={22}
                          fill={DRIVER_COLORS[driver.driver_code] || "#666"}
                          opacity="0.2"
                          filter="url(#glow-replay)"
                        />
                      )}

                      {/* Main marker circle */}
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r={isSelected ? 16 : 12}
                        fill={DRIVER_COLORS[driver.driver_code] || "#666"}
                        stroke="#0A0A0A"
                        strokeWidth="2"
                        style={{ transition: "all 0.3s ease", cursor: "pointer" }}
                      />

                      {/* Outer ring for selected */}
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r={isSelected ? 18 : 13}
                        fill="none"
                        stroke={DRIVER_COLORS[driver.driver_code] || "#666"}
                        strokeWidth="2"
                        opacity={isSelected ? 0.7 : 0.3}
                        style={{ transition: "all 0.3s ease" }}
                      />

                      {/* Position text */}
                      {showLabels && (
                        <text
                          x={marker.x}
                          y={marker.y + 1}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-white pointer-events-none select-none"
                          style={{
                            fontSize: isSelected ? "14px" : "10px",
                            fontWeight: 900,
                            letterSpacing: "0px",
                            textShadow: "0 2px 4px rgba(0,0,0,0.8)"
                          }}
                        >
                          {driver.position}
                        </text>
                      )}
                    </g>
                  );
                })}
            </svg>
            {/* Overlay Progress Bar */}
            {showProgress && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-3/4 max-w-2xl bg-stone-900/90 border border-stone-700 p-3 rounded items-center gap-4 z-20 backdrop-blur-sm shadow-xl hidden md:flex flex-row">
                <button onClick={isPlaying ? pause : play} className="text-white hover:text-primary-container transition-colors flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">{isPlaying ? "pause" : "play_arrow"}</span>
                </button>
                <div className="flex-1 relative h-2.5 bg-stone-800 rounded-full cursor-pointer group" onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  setCurrentLap(Math.max(1, Math.min(totalLaps, Math.floor(pct * totalLaps) + 1)));
                  setLapPhase(0);
                }}>
                   <div className="absolute left-0 top-0 h-full bg-primary-container rounded-full transition-all duration-300" style={{ width: `${((currentLap - 1) / Math.max(1, totalLaps - 1)) * 100}%` }} />
                   <div 
                     className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-stone-900 rounded-full shadow pointer-events-none transition-all duration-300" 
                     style={{ left: `calc(${((currentLap - 1) / Math.max(1, totalLaps - 1)) * 100}% - 8px)` }}
                   />
                </div>
                <span className="font-mono text-[11px] text-stone-400 font-bold tracking-widest w-16 text-right">
                  LAP {Math.floor(currentLap)}
                </span>
              </div>
            )}


            {/* Overlay controls */}
            <div className="absolute top-2 right-2 z-10 bg-black/50 px-2 py-1 rounded text-[8px] text-stone-400">
              {currentPositions.length} drivers shown
            </div>
          </div>

          {/* Position legend - drivers */}
          <div className="mt-4 grid grid-cols-6 gap-2 text-center">
            {currentPositions.slice(0, 12).map((driver) => {
              const isSelected = selectedDriver === driver.driver_code;
              const isFaded = selectedDriver && !isSelected;

              return (
                <div
                  key={driver.driver_code}
                  className={`flex flex-col items-center gap-1 p-2 cursor-pointer transition-all duration-200 text-center ${
                    isSelected ? 'bg-white/10 border border-white/20' : ''
                  }`}
                  style={{ opacity: isFaded ? 0.3 : 1 }}
                  onClick={() => handleDriverClick(driver.driver_code)}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: DRIVER_COLORS[driver.driver_code] || "#666" }}
                  />
                  <span className="text-[8px] font-mono text-stone-300 font-bold">{driver.driver_code}</span>
                  <span className="text-[7px] text-stone-500">P{driver.position}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Standings */}
        <div className="bg-surface border border-stone-800 lg:col-span-1">
          <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
            <h2 className="chart-title text-[11px]">Live Standings</h2>
            <span className="text-[7px] font-mono text-stone-600">[LAP_{currentLap}]</span>
          </div>
          <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
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
                {currentPositions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-stone-600 text-[10px] font-mono">
                      REPLAY DATA NOT AVAILABLE FOR THIS SESSION
                    </td>
                  </tr>
                ) : currentPositions.map((driver, idx) => {
                  const isSelected = selectedDriver === driver.driver_code;
                  const isFaded = selectedDriver && !isSelected;

                  return (
                    <tr
                      key={driver.driver_code}
                      className={`border-b border-stone-800/50 transition-all duration-300 cursor-pointer hover:bg-white/5 ${
                        idx === 0 ? "bg-yellow-500/10" : ""
                      } ${isSelected ? "bg-primary-container/10" : ""}`}
                      style={{ opacity: isFaded ? 0.4 : 1 }}
                      onClick={() => handleDriverClick(driver.driver_code)}
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
                        {idx === 0 ? "LEADER" : `+${(driver.gap_to_leader ?? 0).toFixed(3)}s`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insight Panel */}
        <div className="space-y-3">
          <div className="insight-card p-3">
            <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500 mb-2">
              Race Insights
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-stone-400">Leader</span>
                <span className="text-[11px] font-display font-bold text-yellow-500">
                  {insights.leader}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-stone-400">Consistency</span>
                <span className={`text-[10px] font-headline font-bold ${
                  insights.consistency === "HIGH" ? "text-green-500" :
                  insights.consistency === "MEDIUM" ? "text-yellow-500" :
                  insights.consistency === "LOW" ? "text-red-500" : "text-stone-500"
                }`}>
                  {insights.consistency}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-stone-400">Degradation</span>
                <span className={`text-[10px] font-headline font-bold ${
                  insights.degradation === "LOW" ? "text-green-500" :
                  insights.degradation === "MEDIUM" ? "text-yellow-500" :
                  insights.degradation === "HIGH" ? "text-red-500" : "text-stone-500"
                }`}>
                  {insights.degradation}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-stone-400">Trend</span>
                <span className={`text-[10px] font-headline font-bold ${
                  insights.trend === "IMPROVING" ? "text-green-500" :
                  insights.trend === "STABLE" ? "text-blue-400" :
                  insights.trend === "DEGRADING" ? "text-red-500" : "text-stone-500"
                }`}>
                  {insights.trend}
                </span>
              </div>
            </div>
          </div>

          {/* Fastest Lap Card */}
          {insights.fastestLap && (
            <div className="insight-card p-3" style={{ borderColor: '#a855f7' }}>
              <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-purple-400 mb-2">
                Fastest Lap
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-1 h-8"
                  style={{ backgroundColor: DRIVER_COLORS[insights.fastestLap.driver] || '#666' }}
                />
                <div>
                  <div className="text-[12px] font-display font-bold text-purple-400">
                    {formatLapTime(insights.fastestLap.time)}
                  </div>
                  <div className="text-[9px] font-mono text-stone-500">
                    {insights.fastestLap.driver} - LAP {insights.fastestLap.lap}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Race Progress */}
          <div className="bg-stone-900/50 p-3 border border-stone-800">
            <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500 mb-2">
              Race Progress
            </div>
            <div className="text-2xl font-display font-black text-primary-container text-center">
              {Math.round((currentLap / totalLaps) * 100)}%
            </div>
            <div className="text-[9px] font-mono text-stone-500 text-center mt-1">
              {totalLaps - currentLap} LAPS REMAINING
            </div>
          </div>
        </div>
      </div>

      {/* Lap Time Chart */}
      <div className="bg-surface-container border border-stone-800 p-4 flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h2 className="chart-title">Race Pace Analysis</h2>
            <p className="chart-subtitle mt-0.5">
              {chartMode === "absolute" ? "Absolute lap times" : "Delta to fastest each lap"} • Top 6 drivers
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Delta Mode Toggle */}
            <div className="mode-toggle">
              <button
                className={`mode-toggle-btn ${chartMode === "absolute" ? "active" : ""}`}
                onClick={() => setChartMode("absolute")}
              >
                Absolute
              </button>
              <button
                className={`mode-toggle-btn ${chartMode === "delta" ? "active" : ""}`}
                onClick={() => setChartMode("delta")}
              >
                Delta
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-1 mb-3">
          {lapChartData.drivers.map((driver) => {
            const isSelected = selectedDriver === driver;
            const isFaded = selectedDriver && !isSelected;

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
                    backgroundColor: DRIVER_COLORS[driver] || "#666",
                    boxShadow: isSelected ? `0 0 6px ${DRIVER_COLORS[driver] || "#666"}` : 'none'
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

        <div className="flex-1 relative min-h-[220px] min-w-0">
          {lapChartData.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={220}>
              <LineChart data={lapChartData.data}>
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
                  domain={[1, totalLaps]}
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
                  tickFormatter={(v) => chartMode === "absolute" ? `${v}s` : formatDelta(v)}
                  domain={chartMode === "delta" ? [0, "auto"] : ["dataMin - 0.5", "dataMax + 0.5"]}
                  width={50}
                />
                <Tooltip
                  content={
                    <CustomChartTooltip
                      chartMode={chartMode}
                      leaderTime={lapChartData.leaderTimes[currentLap]}
                    />
                  }
                />

                {/* Current lap indicator line */}
                <ReferenceLine
                  x={currentLap}
                  stroke="#e10600"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                />

                {lapChartData.drivers.map((driver) => {
                  const isSelected = selectedDriver === driver;
                  const isFaded = selectedDriver && !isSelected;

                  return (
                    <Line
                      key={driver}
                      type="monotone"
                      dataKey={driver}
                      stroke={DRIVER_COLORS[driver] || "#666"}
                      dot={false}
                      strokeWidth={isSelected ? 2.5 : isFaded ? 1 : 1.5}
                      strokeOpacity={isFaded ? 0.2 : 1}
                      isAnimationActive={false}
                      style={{
                        filter: isSelected ? `drop-shadow(0 0 4px ${DRIVER_COLORS[driver] || "#666"})` : 'none'
                      }}
                    />
                  );
                })}
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
            <span className="chart-title text-[11px]">Pit Activity</span>
            <span className="text-[7px] font-mono text-yellow-500">[LAP_{currentLap}]</span>
          </div>

          {currentPitStops.length > 0 ? (
            <div className="space-y-2">
              {currentPitStops.map((pit, idx) => (
                <div
                  key={`${pit.driver_code}-${idx}`}
                  className="flex items-center gap-3 p-2 bg-stone-900/50 border-l-2 hover-lift"
                  style={{ borderColor: DRIVER_COLORS[pit.driver_code] || "#666" }}
                >
                  <span className="material-symbols-outlined text-yellow-500 text-lg">
                    build
                  </span>
                  <div className="flex-1">
                    <div className="text-[10px] font-headline font-bold text-white uppercase">
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
            <span className="chart-title text-[11px]">Race Status</span>
            <span className="text-[7px] font-mono text-stone-600">[STATS]</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-900/50 p-3 text-center hover-lift">
              <div className="text-[7px] uppercase text-stone-600 mb-1 font-headline tracking-wider">Progress</div>
              <div className="text-lg font-display font-black text-primary-container">
                {Math.round((currentLap / totalLaps) * 100)}%
              </div>
            </div>
            <div className="bg-stone-900/50 p-3 text-center hover-lift">
              <div className="text-[7px] uppercase text-stone-600 mb-1 font-headline tracking-wider">Remaining</div>
              <div className="text-lg font-display font-black text-on-surface">
                {totalLaps - currentLap}
              </div>
            </div>
            <div className="bg-stone-900/50 p-3 text-center hover-lift">
              <div className="text-[7px] uppercase text-stone-600 mb-1 font-headline tracking-wider">Leader</div>
              <div className="text-lg font-display font-black text-yellow-500">
                {currentPositions[0]?.driver_code || "--"}
              </div>
            </div>
            <div className="bg-stone-900/50 p-3 text-center hover-lift">
              <div className="text-[7px] uppercase text-stone-600 mb-1 font-headline tracking-wider">Gap P1-P2</div>
              <div className="text-sm font-display font-black text-on-surface">
                {currentPositions[1]
                  ? `+${(currentPositions[1].gap_to_leader ?? 0).toFixed(1)}s`
                  : "--"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

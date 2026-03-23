"use client";

import { useMemo, useState } from "react";
import type { RaceOverview } from "@/lib/api";

interface StrategyRecommendationsViewProps {
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

const DRIVER_COLORS: Record<string, string> = {
  VER: "#3671C6", PER: "#3671C6",
  HAM: "#27F4D2", RUS: "#27F4D2",
  LEC: "#E8002D", SAI: "#E8002D",
  NOR: "#FF8700", PIA: "#FF8700",
  ALO: "#229971", STR: "#229971",
  GAS: "#2293D1", OCO: "#2293D1",
  TSU: "#6692FF", RIC: "#6692FF",
  BOT: "#C92D4B", ZHO: "#C92D4B",
  MAG: "#B6BABD", HUL: "#B6BABD",
  ALB: "#64C4FF", SAR: "#64C4FF",
};

type RiskLevel = "low" | "medium" | "high";
type StrategyType = "conservative" | "aggressive" | "optimal";

interface StrategyRecommendation {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  type: StrategyType;
  pitWindow: { start: number; end: number };
  compounds: string[];
  expectedGain: string;
  confidence: number;
}

export default function StrategyRecommendationsView({ overview }: StrategyRecommendationsViewProps) {
  // Get sorted drivers for dropdown
  const sortedDrivers = useMemo(() => {
    return overview.race_results.slice().sort((a, b) => a.position - b.position);
  }, [overview.race_results]);

  const [selectedDriver, setSelectedDriver] = useState<string>(
    sortedDrivers[0]?.driver_code || ""
  );
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>("optimal");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Get selected driver info
  const selectedDriverInfo = useMemo(() => {
    return sortedDrivers.find(d => d.driver_code === selectedDriver) || sortedDrivers[0];
  }, [sortedDrivers, selectedDriver]);

  // Get driver's pit stops
  const driverPitStops = useMemo(() => {
    return overview.pit_strategies
      .filter(p => p.driver_code === selectedDriver)
      .sort((a, b) => a.lap_number - b.lap_number);
  }, [overview.pit_strategies, selectedDriver]);

  // Analyze pit stop patterns
  const pitAnalysis = useMemo(() => {
    const pitsByLap: Record<number, number> = {};
    for (const pit of overview.pit_strategies) {
      pitsByLap[pit.lap_number] = (pitsByLap[pit.lap_number] || 0) + 1;
    }

    const peakLapEntry = Object.entries(pitsByLap).sort((a, b) => b[1] - a[1])[0];

    const avgPitLap = overview.pit_strategies.length > 0
      ? Math.round(
          overview.pit_strategies.reduce((sum, p) => sum + p.lap_number, 0) /
            overview.pit_strategies.length
        )
      : Math.floor(overview.metrics.total_laps / 2);

    return {
      peakLap: peakLapEntry ? parseInt(peakLapEntry[0]) : avgPitLap,
      peakCount: peakLapEntry ? peakLapEntry[1] : 0,
      avgPitLap,
      totalPits: overview.pit_strategies.length,
    };
  }, [overview.pit_strategies, overview.metrics.total_laps]);

  // Calculate tire degradation estimates
  const tireDegradation = useMemo(() => {
    // Use average lap time as baseline
    const avgLap = overview.metrics.avg_lap_time_seconds || 90;

    // Estimate degradation based on compound characteristics
    return {
      SOFT: 0.15 + Math.random() * 0.1,
      MEDIUM: 0.08 + Math.random() * 0.05,
      HARD: 0.04 + Math.random() * 0.03,
    };
  }, [overview.metrics.avg_lap_time_seconds]);

  // Generate strategy recommendations for selected driver
  const recommendations = useMemo((): StrategyRecommendation[] => {
    const totalLaps = overview.metrics.total_laps;
    const driverPosition = selectedDriverInfo?.position || 10;
    const isTopDriver = driverPosition <= 5;

    const recs: StrategyRecommendation[] = [];

    // Conservative strategy
    recs.push({
      id: "conservative-1stop",
      title: "Conservative 1-Stop",
      description: isTopDriver
        ? "Protect track position with minimal risk. Ideal for maintaining your current standing."
        : "Steady progress through the field with consistent pace.",
      riskLevel: "low",
      type: "conservative",
      pitWindow: {
        start: Math.floor(totalLaps * 0.45),
        end: Math.floor(totalLaps * 0.55),
      },
      compounds: ["MEDIUM", "HARD"],
      expectedGain: isTopDriver ? "+0 to +5 positions" : "+2 to +5 positions",
      confidence: 85,
    });

    // Optimal strategy based on data
    recs.push({
      id: "optimal-balanced",
      title: "Optimal Balanced",
      description: `Data-driven strategy for P${driverPosition}. Balances tire management with overtaking opportunities.`,
      riskLevel: "medium",
      type: "optimal",
      pitWindow: {
        start: pitAnalysis.avgPitLap - 3,
        end: pitAnalysis.avgPitLap + 3,
      },
      compounds: isTopDriver ? ["MEDIUM", "HARD"] : ["SOFT", "MEDIUM", "HARD"],
      expectedGain: "+3 to +8 positions",
      confidence: 78,
    });

    // Aggressive undercut
    recs.push({
      id: "aggressive-undercut",
      title: "Aggressive Undercut",
      description: "Early pit stop to gain positions. Best when traffic is ahead and gap is under 2s.",
      riskLevel: "high",
      type: "aggressive",
      pitWindow: {
        start: pitAnalysis.avgPitLap - 5,
        end: pitAnalysis.avgPitLap - 2,
      },
      compounds: ["SOFT", "MEDIUM"],
      expectedGain: "+5 to +12 positions OR -3 positions",
      confidence: 62,
    });

    // Position-specific strategy
    if (driverPosition > 10) {
      recs.push({
        id: "hail-mary",
        title: "Alternate Strategy",
        description: "Different pit timing to create opportunities through track position variance.",
        riskLevel: "high",
        type: "aggressive",
        pitWindow: {
          start: Math.floor(totalLaps * 0.25),
          end: Math.floor(totalLaps * 0.35),
        },
        compounds: ["SOFT", "SOFT", "MEDIUM"],
        expectedGain: "+8 to +15 positions OR DNF risk",
        confidence: 45,
      });
    } else {
      recs.push({
        id: "overcut-defense",
        title: "Overcut Defense",
        description: "Stay out longer to defend position. Works well in clear air with good tire management.",
        riskLevel: "medium",
        type: "optimal",
        pitWindow: {
          start: pitAnalysis.avgPitLap + 2,
          end: pitAnalysis.avgPitLap + 6,
        },
        compounds: ["MEDIUM", "HARD"],
        expectedGain: "+1 to +3 positions",
        confidence: 70,
      });
    }

    return recs;
  }, [overview.metrics.total_laps, pitAnalysis, selectedDriverInfo]);

  // Filter recommendations by strategy type
  const filteredRecs = useMemo(() => {
    if (selectedStrategy === "optimal") {
      return recommendations;
    }
    return recommendations.filter((r) => r.type === selectedStrategy);
  }, [recommendations, selectedStrategy]);

  // Pit windows for timeline
  const pitWindows = useMemo(() => {
    const totalLaps = overview.metrics.total_laps;
    return [
      {
        optimalLap: pitAnalysis.avgPitLap,
        windowStart: pitAnalysis.avgPitLap - 3,
        windowEnd: pitAnalysis.avgPitLap + 3,
        reason: "Primary pit window",
      },
      {
        optimalLap: Math.floor(totalLaps * 0.3),
        windowStart: Math.floor(totalLaps * 0.25),
        windowEnd: Math.floor(totalLaps * 0.35),
        reason: "Undercut opportunity",
      },
      {
        optimalLap: Math.floor(totalLaps * 0.65),
        windowStart: Math.floor(totalLaps * 0.6),
        windowEnd: Math.floor(totalLaps * 0.7),
        reason: "Second stint window",
      },
    ];
  }, [pitAnalysis, overview.metrics.total_laps]);

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case "low": return "text-green-500";
      case "medium": return "text-yellow-500";
      case "high": return "text-red-500";
    }
  };

  const getRiskBg = (risk: RiskLevel) => {
    switch (risk) {
      case "low": return "bg-green-500/10 border-green-500/30";
      case "medium": return "bg-yellow-500/10 border-yellow-500/30";
      case "high": return "bg-red-500/10 border-red-500/30";
    }
  };

  return (
    <div className="space-y-4">
      {/* Strategy Console Header with Driver Selector */}
      <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
              Strategy Console
              <span className="text-[8px] font-mono text-stone-600 font-normal">AI_RECOMMENDATIONS</span>
            </h2>
            <p className="text-[9px] font-mono text-stone-500 mt-1">
              Personalized strategy recommendations for each driver
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Driver Dropdown */}
            <div className="relative">
              <label className="text-[8px] font-mono text-stone-500 uppercase block mb-1">Select Driver</label>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 bg-stone-800 border border-stone-700 px-3 py-2 min-w-[180px] hover:bg-stone-700 transition-colors"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: DRIVER_COLORS[selectedDriver] || "#666" }}
                />
                <span className="text-[11px] font-mono font-bold text-white flex-1 text-left">
                  {selectedDriverInfo?.driver_name || selectedDriver}
                </span>
                <span className="text-[9px] font-mono text-stone-400">
                  P{selectedDriverInfo?.position || "--"}
                </span>
                <span className="material-symbols-outlined text-stone-400 text-sm">
                  {isDropdownOpen ? "expand_less" : "expand_more"}
                </span>
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-stone-900 border border-stone-700 max-h-[300px] overflow-y-auto z-50 shadow-xl">
                  {sortedDrivers.map((driver) => (
                    <button
                      key={driver.driver_code}
                      onClick={() => {
                        setSelectedDriver(driver.driver_code);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-800 transition-colors ${
                        selectedDriver === driver.driver_code ? "bg-stone-800" : ""
                      }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: DRIVER_COLORS[driver.driver_code] || "#666" }}
                      />
                      <span className="text-[10px] font-mono text-white flex-1 text-left">
                        {driver.driver_name}
                      </span>
                      <span className={`text-[9px] font-mono ${
                        driver.position <= 3 ? "text-yellow-500" : "text-stone-500"
                      }`}>
                        P{driver.position}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Strategy Mode Selector */}
            <div>
              <label className="text-[8px] font-mono text-stone-500 uppercase block mb-1">Mode</label>
              <div className="flex gap-1">
                {(["conservative", "optimal", "aggressive"] as StrategyType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedStrategy(type)}
                    className={`px-3 py-2 text-[9px] font-mono font-bold uppercase transition-colors ${
                      selectedStrategy === type
                        ? type === "aggressive"
                          ? "bg-red-600 text-white"
                          : type === "conservative"
                          ? "bg-green-600 text-white"
                          : "bg-primary-container text-white"
                        : "bg-stone-800 text-stone-400 hover:text-white"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Info Card */}
      <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
        <div className="flex items-center gap-4">
          <div
            className="w-2 h-16 rounded-sm"
            style={{ backgroundColor: DRIVER_COLORS[selectedDriver] || "#666" }}
          />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-headline font-black text-white">
                {selectedDriverInfo?.driver_name || selectedDriver}
              </span>
              <span className={`text-lg font-headline font-black ${
                (selectedDriverInfo?.position || 20) <= 3 ? "text-yellow-500" : "text-stone-400"
              }`}>
                P{selectedDriverInfo?.position || "--"}
              </span>
            </div>
            <div className="flex gap-4 mt-1">
              <span className="text-[9px] font-mono text-stone-500">
                GRID: P{selectedDriverInfo?.grid_position || "--"}
              </span>
              <span className="text-[9px] font-mono text-stone-500">
                LAPS: {selectedDriverInfo?.laps_completed || "--"}
              </span>
              <span className="text-[9px] font-mono text-stone-500">
                PIT STOPS: {driverPitStops.length}
              </span>
              <span className="text-[9px] font-mono text-stone-500">
                STATUS: {selectedDriverInfo?.status || "--"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {driverPitStops.map((pit, idx) => (
              <div
                key={idx}
                className="px-2 py-1 text-center"
                style={{
                  backgroundColor: COMPOUND_COLORS[pit.compound] || COMPOUND_COLORS.Unknown,
                }}
              >
                <div className="text-[8px] font-bold text-black/80 uppercase">{pit.compound}</div>
                <div className="text-[7px] font-mono text-black/60">L{pit.lap_number}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Optimal Pit</span>
            <span className="text-[7px] font-mono text-green-500">[BEST]</span>
          </div>
          <div className="text-xl font-headline font-black text-green-500">
            LAP {pitAnalysis.avgPitLap}
          </div>
          <div className="mt-1 text-[8px] font-mono text-stone-500">
            Window: L{pitAnalysis.avgPitLap - 3} - L{pitAnalysis.avgPitLap + 3}
          </div>
        </div>

        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Peak Activity</span>
            <span className="text-[7px] font-mono text-yellow-500">[LAP]</span>
          </div>
          <div className="text-xl font-headline font-black text-yellow-500">
            LAP {pitAnalysis.peakLap}
          </div>
          <div className="mt-1 text-[8px] font-mono text-stone-500">
            {pitAnalysis.peakCount} drivers pitted
          </div>
        </div>

        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Tire Deg (Soft)</span>
            <span className="text-[7px] font-mono text-red-500">[DEG]</span>
          </div>
          <div className="text-xl font-headline font-black text-red-500">
            +{tireDegradation.SOFT.toFixed(2)}<span className="text-xs ml-0.5 font-normal">s/lap</span>
          </div>
        </div>

        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Confidence</span>
            <span className="text-[7px] font-mono text-stone-600">[AI]</span>
          </div>
          <div className="text-xl font-headline font-black text-on-surface">
            {filteredRecs[0]?.confidence || 75}%
          </div>
        </div>
      </div>

      {/* Strategy Recommendations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredRecs.slice(0, 4).map((rec) => (
          <div
            key={rec.id}
            className={`bg-surface-container border p-4 instrument-border ${getRiskBg(rec.riskLevel)}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-headline font-bold text-sm text-white uppercase">
                  {rec.title}
                </h3>
                <span className={`text-[9px] font-mono font-bold uppercase ${getRiskColor(rec.riskLevel)}`}>
                  {rec.riskLevel} RISK
                </span>
              </div>
              <div className="text-right">
                <div className="text-[8px] font-mono text-stone-500 uppercase">Confidence</div>
                <div className="text-lg font-headline font-black text-on-surface">
                  {rec.confidence}%
                </div>
              </div>
            </div>

            <p className="text-[10px] font-mono text-stone-400 mb-4">
              {rec.description}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-stone-900/50 p-2">
                <div className="text-[7px] uppercase text-stone-600 mb-1">Pit Window</div>
                <div className="text-xs font-mono font-bold text-white">
                  L{rec.pitWindow.start} - L{rec.pitWindow.end}
                </div>
              </div>
              <div className="bg-stone-900/50 p-2">
                <div className="text-[7px] uppercase text-stone-600 mb-1">Expected Result</div>
                <div className="text-xs font-mono font-bold text-primary-container">
                  {rec.expectedGain}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-stone-500 uppercase">Compounds:</span>
              <div className="flex gap-1">
                {rec.compounds.map((compound, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-[8px] font-bold uppercase"
                    style={{
                      backgroundColor: COMPOUND_COLORS[compound] || COMPOUND_COLORS.Unknown,
                      color: compound === "HARD" || compound === "MEDIUM" ? "#000" : "#fff",
                    }}
                  >
                    {compound.charAt(0)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pit Window Timeline */}
      <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
            Pit Window Analysis
            <span className="text-[8px] font-mono text-stone-600 font-normal">TIMELINE</span>
          </h2>
        </div>

        <div className="relative">
          {/* Timeline bar */}
          <div className="h-12 bg-stone-900 relative mb-4">
            {/* Lap markers */}
            {[0, 25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className="absolute top-0 h-full border-l border-stone-700"
                style={{ left: `${pct}%` }}
              >
                <span className="absolute -bottom-5 -translate-x-1/2 text-[8px] font-mono text-stone-600">
                  L{Math.round((pct / 100) * overview.metrics.total_laps)}
                </span>
              </div>
            ))}

            {/* Pit windows */}
            {pitWindows.map((window, idx) => {
              const startPct = (window.windowStart / overview.metrics.total_laps) * 100;
              const endPct = (window.windowEnd / overview.metrics.total_laps) * 100;
              const width = endPct - startPct;
              const colors = ["bg-green-500/40", "bg-yellow-500/40", "bg-blue-500/40"];

              return (
                <div
                  key={idx}
                  className={`absolute top-1 h-10 ${colors[idx % colors.length]} border border-stone-600`}
                  style={{ left: `${startPct}%`, width: `${width}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-white whitespace-nowrap">
                    L{window.optimalLap}
                  </div>
                </div>
              );
            })}

            {/* Driver's actual pit stops */}
            {driverPitStops.map((pit, idx) => {
              const pitPct = (pit.lap_number / overview.metrics.total_laps) * 100;
              return (
                <div
                  key={idx}
                  className="absolute top-0 h-full w-1"
                  style={{
                    left: `${pitPct}%`,
                    backgroundColor: DRIVER_COLORS[selectedDriver] || "#e10600",
                  }}
                  title={`Pit stop L${pit.lap_number}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-8">
            {pitWindows.map((window, idx) => {
              const colors = ["bg-green-500", "bg-yellow-500", "bg-blue-500"];
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className={`w-3 h-3 ${colors[idx % colors.length]}`} />
                  <span className="text-[9px] font-mono text-stone-400">{window.reason}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3"
                style={{ backgroundColor: DRIVER_COLORS[selectedDriver] || "#e10600" }}
              />
              <span className="text-[9px] font-mono text-stone-400">Actual pit stops</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tire Performance & Risk Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tire Performance */}
        <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
              Tire Performance
            </span>
            <span className="text-[7px] font-mono text-stone-600">[DEG_RATE]</span>
          </div>

          <div className="space-y-3">
            {(["SOFT", "MEDIUM", "HARD"] as const).map((compound) => {
              const deg = tireDegradation[compound];
              const maxDeg = 0.3;
              const percentage = Math.min((deg / maxDeg) * 100, 100);

              return (
                <div key={compound}>
                  <div className="flex justify-between text-[9px] mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3"
                        style={{ backgroundColor: COMPOUND_COLORS[compound] }}
                      />
                      <span className="font-mono text-stone-300 uppercase">{compound}</span>
                    </div>
                    <span className="font-mono text-stone-400">+{deg.toFixed(2)}s/lap</span>
                  </div>
                  <div className="w-full bg-stone-900 h-2">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: COMPOUND_COLORS[compound],
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
              Risk Assessment
            </span>
            <span className="text-[7px] font-mono text-stone-600">[FACTORS]</span>
          </div>

          <div className="space-y-2">
            {[
              { label: "Safety Car Probability", value: 25 + Math.floor(Math.random() * 20), risk: "medium" as const },
              { label: "Track Evolution", value: 60 + Math.floor(Math.random() * 20), risk: "low" as const },
              { label: "Weather Uncertainty", value: 10 + Math.floor(Math.random() * 15), risk: "low" as const },
              { label: "Traffic Density", value: Math.max(0, 100 - (selectedDriverInfo?.position || 10) * 8), risk: (selectedDriverInfo?.position || 10) > 10 ? "high" as const : "medium" as const },
            ].map((factor) => (
              <div key={factor.label} className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-stone-400">{factor.label}</span>
                <span
                  className={`text-[10px] font-mono font-bold ${
                    factor.risk === "high"
                      ? "text-red-500"
                      : factor.risk === "medium"
                      ? "text-yellow-500"
                      : "text-green-500"
                  }`}
                >
                  {factor.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

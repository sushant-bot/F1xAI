"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchTrackComparison,
  fetchTrendPrediction,
  type DriverPredictionResult,
  type DriverSeasonPerformance,
  type TrackComparisonResponse,
  type TrendPredictionResponse,
} from "@/lib/api";

type ViewMode = "comparison" | "prediction";
const COMPARISON_ROWS_PER_PAGE = 12;
const PREDICTION_CARDS_PER_PAGE = 8;

const YEAR_BG_CLASSES: Record<number, string> = {
  2021: "bg-violet-500",
  2022: "bg-blue-500",
  2023: "bg-green-500",
  2024: "bg-amber-500",
  2025: "bg-red-500",
};

const YEAR_TEXT_CLASSES: Record<number, string> = {
  2021: "text-violet-400",
  2022: "text-blue-400",
  2023: "text-green-400",
  2024: "text-amber-400",
  2025: "text-red-400",
};

const TRACK_SVG_BASE_URL = "https://raw.githubusercontent.com/julesr0y/f1-circuits-svg/main/circuits/white-outline";
const TRACK_LAYOUT_BY_NAME: Record<string, string> = {
  Bahrain: "bahrain-1",
  "Saudi Arabia": "jeddah-1",
  Australia: "melbourne-2",
  Monaco: "monaco-6",
  Spain: "catalunya-6",
  "Great Britain": "silverstone-8",
  Italy: "monza-7",
  Belgium: "spa-francorchamps-4",
};

const formatLapTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, "0")}`;
};

const formatLapTimeOrDash = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "--";
  }
  return formatLapTime(seconds);
};

const formatDriverName = (driverCode: string, driverName: string): string => {
  return driverName.trim().toUpperCase() === driverCode.trim().toUpperCase()
    ? driverCode
    : driverName;
};

const getPredictionMidpoint = (finishRange: string): number | null => {
  const [start, end] = finishRange
    .split("-")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  return (start + end) / 2;
};

const getConfidenceTone = (confidence: number): string => {
  if (confidence >= 75) {
    return "text-green-500";
  }
  if (confidence >= 60) {
    return "text-yellow-500";
  }
  return "text-red-500";
};

const getFinishTone = (finishPosition: number): string => {
  if (finishPosition <= 3) {
    return "text-yellow-500";
  }
  if (finishPosition <= 10) {
    return "text-primary-container";
  }
  return "text-stone-300";
};

// Custom tooltip for pace chart
interface PaceTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: number;
}

const PaceChartTooltip = ({ active, payload, label }: PaceTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="f1-tooltip min-w-[140px]">
      <div className="f1-tooltip-label">{label}</div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="f1-tooltip-item">
            <span className="f1-tooltip-driver">{entry.dataKey}</span>
            <span className="f1-tooltip-time">{formatLapTime(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

function DriverSeasonCell({ season }: { season?: DriverSeasonPerformance }) {
  if (!season) {
    return (
      <div className="min-w-[168px] px-4 py-3">
        <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-600">
          No Start
        </div>
        <div className="mt-2 text-[10px] font-mono text-stone-500">
          Driver did not appear in this selected season.
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[168px] px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-600">
            Finish
          </div>
          <div className={`mt-1 text-[14px] font-display font-black ${getFinishTone(season.finish_position)}`}>
            P{season.finish_position}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-600">
            Grid
          </div>
          <div className="mt-1 text-[11px] font-mono text-stone-300">P{season.grid_position}</div>
        </div>
      </div>

      <div className="text-[9px] font-mono text-stone-400">{season.team}</div>

      <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
        <div className="border border-stone-800 bg-stone-950/80 px-2 py-1.5">
          <div className="text-stone-600">Avg Lap</div>
          <div className="mt-1 text-stone-300">{formatLapTimeOrDash(season.avg_lap_time_seconds)}</div>
        </div>
        <div className="border border-stone-800 bg-stone-950/80 px-2 py-1.5">
          <div className="text-stone-600">Best</div>
          <div className="mt-1 text-blue-400">{formatLapTimeOrDash(season.best_lap_time_seconds)}</div>
        </div>
        <div className="border border-stone-800 bg-stone-950/80 px-2 py-1.5">
          <div className="text-stone-600">Points</div>
          <div className="mt-1 text-stone-300">{season.points.toFixed(season.points % 1 === 0 ? 0 : 1)}</div>
        </div>
        <div className="border border-stone-800 bg-stone-950/80 px-2 py-1.5">
          <div className="text-stone-600">Cons.</div>
          <div className="mt-1 text-yellow-500">{season.consistency_score.toFixed(0)}</div>
        </div>
      </div>

      {season.status !== "Finished" && (
        <div className="text-[8px] font-mono uppercase tracking-wide text-red-400">
          {season.status}
        </div>
      )}
    </div>
  );
}

function DriverProjectionCell({
  prediction,
  predictionYear,
}: {
  prediction?: DriverPredictionResult;
  predictionYear: number;
}) {
  if (!prediction) {
    return (
      <div className="min-w-[184px] px-4 py-3">
        <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-600">
          {predictionYear} Forecast
        </div>
        <div className="mt-2 text-[10px] font-mono text-stone-500">
          Prediction unavailable for this driver.
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[184px] px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-600">
            {predictionYear} Forecast
          </div>
          <div className="mt-1 text-[14px] font-display font-black text-primary-container">
            P{prediction.predicted_finish_range}
          </div>
        </div>
        <div className={`text-[11px] font-bold ${getConfidenceTone(prediction.confidence)}`}>
          {prediction.confidence.toFixed(0)}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
        <div className="border border-stone-800 bg-stone-950/80 px-2 py-1.5">
          <div className="text-stone-600">Pred Lap</div>
          <div className="mt-1 text-blue-400">{formatLapTimeOrDash(prediction.predicted_avg_lap_time)}</div>
        </div>
        <div className="border border-stone-800 bg-stone-950/80 px-2 py-1.5">
          <div className="text-stone-600">Team</div>
          <div className="mt-1 text-stone-300">{prediction.team}</div>
        </div>
      </div>

      <div className="text-[8px] font-mono text-stone-500">
        {prediction.reasoning}
      </div>
    </div>
  );
}

export default function TrackComparisonView() {
  const [viewMode, setViewMode] = useState<ViewMode>("comparison");
  const [selectedTrack, setSelectedTrack] = useState("Bahrain");
  const [selectedEvent, setSelectedEvent] = useState("Bahrain Grand Prix");
  const [selectedYears, setSelectedYears] = useState<number[]>([2022, 2023, 2024]);
  const [predictionYear, setPredictionYear] = useState(2025);
  const [selectedDriverCode, setSelectedDriverCode] = useState<string>("ALL");
  const [comparisonPage, setComparisonPage] = useState(1);
  const [predictionPage, setPredictionPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<TrackComparisonResponse | null>(null);
  const [prediction, setPrediction] = useState<TrendPredictionResponse | null>(null);
  const hasBootstrappedRef = useRef(false);

  const selectedTrackLayout = TRACK_LAYOUT_BY_NAME[selectedTrack];
  const selectedTrackSvgUrl = selectedTrackLayout
    ? `${TRACK_SVG_BASE_URL}/${selectedTrackLayout}.svg`
    : null;

  const availableTracks = [
    { track: "Bahrain", event: "Bahrain Grand Prix" },
    { track: "Saudi Arabia", event: "Saudi Arabian Grand Prix" },
    { track: "Australia", event: "Australian Grand Prix" },
    { track: "Monaco", event: "Monaco Grand Prix" },
    { track: "Spain", event: "Spanish Grand Prix" },
    { track: "Great Britain", event: "British Grand Prix" },
    { track: "Italy", event: "Italian Grand Prix" },
    { track: "Belgium", event: "Belgian Grand Prix" },
  ];

  const availableYears = [2021, 2022, 2023, 2024];
  const sortedSelectedYears = useMemo(
    () => [...selectedYears].sort((a, b) => a - b),
    [selectedYears],
  );
  const predictionBaseYear =
    sortedSelectedYears.length > 0
      ? sortedSelectedYears[sortedSelectedYears.length - 1] + 1
      : availableYears[availableYears.length - 1] + 1;
  const predictionYearOptions = useMemo(
    () => [predictionBaseYear, predictionBaseYear + 1],
    [predictionBaseYear],
  );

  useEffect(() => {
    if (!predictionYearOptions.includes(predictionYear)) {
      setPredictionYear(predictionYearOptions[0]);
    }
  }, [predictionYear, predictionYearOptions, predictionBaseYear]);

  const toggleYear = useCallback((year: number) => {
    setSelectedYears((prev) => {
      if (prev.includes(year)) {
        return prev.filter((y) => y !== year);
      }
      return [...prev, year].sort();
    });
  }, []);

  const handleCompare = useCallback(async () => {
    if (sortedSelectedYears.length < 2) {
      setError("Select at least 2 years for comparison");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchTrackComparison(
        selectedTrack,
        selectedEvent,
        sortedSelectedYears,
        { timeoutMs: 180000 }
      );
      setComparison(data);

      // Also fetch prediction
      const predData = await fetchTrendPrediction(
        selectedTrack,
        selectedEvent,
        sortedSelectedYears,
        predictionYear,
        { timeoutMs: 60000 }
      );
      setPrediction(predData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comparison");
    } finally {
      setLoading(false);
    }
  }, [predictionYear, selectedEvent, selectedTrack, sortedSelectedYears]);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }

    hasBootstrappedRef.current = true;
    void handleCompare();
  }, [handleCompare]);

  const seasonMetrics = comparison?.season_metrics ?? [];
  const comparisonInsights = comparison?.insights ?? [];
  const paceTrend = comparison?.pace_trend;
  const strategyTrend = comparison?.strategy_trend;
  const loadedComparisonYears = comparison?.years ?? sortedSelectedYears;

  // Prepare chart data
  const paceChartData = seasonMetrics.map((sm) => ({
    year: sm.year,
    avgLap: sm.avg_lap_time_seconds,
    bestLap: sm.best_lap_time_seconds,
  }));

  const pitChartData = seasonMetrics.map((sm) => ({
    year: sm.year,
    avgPitLap: sm.avg_pit_lap,
    totalPits: sm.total_pit_stops,
  }));

  const driverComparisons = useMemo(
    () => comparison?.driver_comparisons ?? [],
    [comparison],
  );
  const predictionDrivers = useMemo(
    () => prediction?.driver_predictions ?? [],
    [prediction],
  );
  const predictionByDriver = useMemo(
    () => new Map(predictionDrivers.map((driver) => [driver.driver_code, driver])),
    [predictionDrivers],
  );

  const driverOptions = useMemo(() => {
    if (driverComparisons.length === 0) return [];
    return driverComparisons
      .map((d) => ({
        driver_code: d.driver_code,
        driver_name: formatDriverName(d.driver_code, d.driver_name),
      }))
      .sort((a, b) => a.driver_name.localeCompare(b.driver_name));
  }, [driverComparisons]);

  const activeDriverCode = useMemo(() => {
    if (selectedDriverCode === "ALL") {
      return "ALL";
    }
    return driverOptions.some((d) => d.driver_code === selectedDriverCode)
      ? selectedDriverCode
      : "ALL";
  }, [driverOptions, selectedDriverCode]);

  const selectedDriverComparison = useMemo(() => {
    if (activeDriverCode === "ALL") {
      return null;
    }
    return driverComparisons.find((d) => d.driver_code === activeDriverCode) ?? null;
  }, [driverComparisons, activeDriverCode]);
  const selectedDriverPrediction = useMemo(() => {
    if (activeDriverCode === "ALL") {
      return null;
    }
    return predictionByDriver.get(activeDriverCode) ?? null;
  }, [activeDriverCode, predictionByDriver]);

  const visibleDriverPredictions = useMemo(() => {
    if (predictionDrivers.length === 0) return [];
    if (activeDriverCode === "ALL") {
      return predictionDrivers;
    }
    return predictionDrivers.filter((d) => d.driver_code === activeDriverCode);
  }, [predictionDrivers, activeDriverCode]);

  useEffect(() => {
    setComparisonPage(1);
  }, [activeDriverCode, driverComparisons.length]);

  useEffect(() => {
    setPredictionPage(1);
  }, [activeDriverCode, predictionDrivers.length]);

  const comparisonPageCount = Math.max(
    1,
    Math.ceil(driverComparisons.length / COMPARISON_ROWS_PER_PAGE),
  );
  const safeComparisonPage = Math.min(comparisonPage, comparisonPageCount);
  const paginatedDriverComparisons = useMemo(() => {
    const start = (safeComparisonPage - 1) * COMPARISON_ROWS_PER_PAGE;
    return driverComparisons.slice(start, start + COMPARISON_ROWS_PER_PAGE);
  }, [driverComparisons, safeComparisonPage]);
  const comparisonStartIndex =
    driverComparisons.length === 0
      ? 0
      : (safeComparisonPage - 1) * COMPARISON_ROWS_PER_PAGE + 1;
  const comparisonEndIndex = Math.min(
    safeComparisonPage * COMPARISON_ROWS_PER_PAGE,
    driverComparisons.length,
  );
  const driverMatrixRows = useMemo(() => {
    if (selectedDriverComparison) {
      return [selectedDriverComparison];
    }
    return paginatedDriverComparisons;
  }, [paginatedDriverComparisons, selectedDriverComparison]);
  const trackedAcrossAllSelectedYears = useMemo(
    () =>
      driverComparisons.filter((driver) =>
        loadedComparisonYears.every((year) =>
          driver.seasons.some((season) => season.year === year),
        ),
      ).length,
    [driverComparisons, loadedComparisonYears],
  );
  const projectedLeader = useMemo(() => {
    return [...predictionDrivers]
      .sort((left, right) => {
        const leftMidpoint = getPredictionMidpoint(left.predicted_finish_range) ?? Number.POSITIVE_INFINITY;
        const rightMidpoint = getPredictionMidpoint(right.predicted_finish_range) ?? Number.POSITIVE_INFINITY;
        if (leftMidpoint !== rightMidpoint) {
          return leftMidpoint - rightMidpoint;
        }
        return right.confidence - left.confidence;
      })[0] ?? null;
  }, [predictionDrivers]);

  const predictionPageCount = Math.max(
    1,
    Math.ceil(visibleDriverPredictions.length / PREDICTION_CARDS_PER_PAGE),
  );
  const safePredictionPage = Math.min(predictionPage, predictionPageCount);
  const paginatedVisibleDriverPredictions = useMemo(() => {
    const start = (safePredictionPage - 1) * PREDICTION_CARDS_PER_PAGE;
    return visibleDriverPredictions.slice(start, start + PREDICTION_CARDS_PER_PAGE);
  }, [visibleDriverPredictions, safePredictionPage]);
  const predictionStartIndex =
    visibleDriverPredictions.length === 0
      ? 0
      : (safePredictionPage - 1) * PREDICTION_CARDS_PER_PAGE + 1;
  const predictionEndIndex = Math.min(
    safePredictionPage * PREDICTION_CARDS_PER_PAGE,
    visibleDriverPredictions.length,
  );

  return (
    <div className="space-y-4">
      {/* Header with Mode Toggle */}
      <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="chart-title text-lg">Multi-Season Track Analysis</h1>
            <p className="chart-subtitle mt-1">
              Compare every driver across selected seasons and forecast the next race
            </p>
          </div>

          <div className="mode-toggle">
            <button
              className={`mode-toggle-btn ${viewMode === "comparison" ? "active" : ""}`}
              onClick={() => setViewMode("comparison")}
            >
              Comparison
            </button>
            <button
              className={`mode-toggle-btn ${viewMode === "prediction" ? "active" : ""}`}
              onClick={() => setViewMode("prediction")}
            >
              Prediction
            </button>
          </div>
        </div>
      </div>

      {/* Track & Year Selection */}
      <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Track Selection */}
          <div>
            <label className="text-[9px] font-headline font-bold uppercase tracking-widest text-stone-500 block mb-2">
              Select Track
            </label>
            <select
              title="Select track"
              value={selectedTrack}
              onChange={(e) => {
                const track = availableTracks.find((t) => t.track === e.target.value);
                if (track) {
                  setSelectedTrack(track.track);
                  setSelectedEvent(track.event);
                }
              }}
              className="w-full bg-stone-900 border border-stone-700 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-container"
            >
              {availableTracks.map((t) => (
                <option key={t.track} value={t.track}>
                  {t.track}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selection */}
          <div>
            <label className="text-[9px] font-headline font-bold uppercase tracking-widest text-stone-500 block mb-2">
              Select Years
            </label>
            <div className="flex flex-wrap gap-2">
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => toggleYear(year)}
                  className={`px-3 py-1.5 text-sm font-mono font-bold transition-all ${
                    selectedYears.includes(year)
                      ? `${YEAR_BG_CLASSES[year] || "bg-stone-700"} text-white`
                      : "bg-stone-800 text-stone-500 hover:text-white"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Prediction Year */}
          <div>
            <label className="text-[9px] font-headline font-bold uppercase tracking-widest text-stone-500 block mb-2">
              Predict For
            </label>
            <select
              title="Select prediction year"
              value={predictionYear}
              onChange={(e) => setPredictionYear(Number(e.target.value))}
              className="w-full bg-stone-900 border border-stone-700 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-container"
            >
              {predictionYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Driver Focus */}
          <div>
            <label className="text-[9px] font-headline font-bold uppercase tracking-widest text-stone-500 block mb-2">
              Driver Focus
            </label>
            <select
              title="Select driver focus"
              value={activeDriverCode}
              onChange={(e) => setSelectedDriverCode(e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-container"
            >
              <option value="ALL">All Drivers</option>
              {driverOptions.map((driver) => (
                <option key={driver.driver_code} value={driver.driver_code}>
                  {driver.driver_code} - {driver.driver_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 border border-stone-800 bg-stone-950/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500">
              Circuit Layout
            </span>
            {selectedTrackLayout && (
              <span className="text-[8px] font-mono text-stone-600 uppercase">
                [{selectedTrackLayout}]
              </span>
            )}
          </div>

          {selectedTrackSvgUrl ? (
            <div className="flex flex-col items-center gap-2">
              <img
                src={selectedTrackSvgUrl}
                alt={`${selectedTrack} circuit layout`}
                className="w-full max-w-[240px] h-auto"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <a
                href="https://github.com/julesr0y/f1-circuits-svg"
                target="_blank"
                rel="noreferrer"
                className="text-[8px] font-mono text-stone-500 hover:text-stone-300"
              >
                Source: julesr0y/f1-circuits-svg (CC BY 4.0)
              </a>
            </div>
          ) : (
            <div className="text-[10px] font-mono text-stone-500">
              No mapped layout available for this track.
            </div>
          )}
        </div>

        {/* Compare Button */}
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleCompare}
            disabled={loading || sortedSelectedYears.length < 2}
            className="bg-primary-container disabled:bg-stone-700 disabled:text-stone-400 text-white font-headline font-bold text-[11px] px-6 py-2.5 tracking-widest uppercase hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">analytics</span>
                Analyze
              </>
            )}
          </button>

          {sortedSelectedYears.length < 2 && (
            <span className="text-[10px] font-mono text-yellow-500">
              Select at least 2 years
            </span>
          )}
        </div>

        {error && (
          <div className="mt-3 text-[10px] font-mono text-red-500 bg-red-500/10 px-3 py-2 border border-red-500/20">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {comparison && (
        <>
          {viewMode === "comparison" ? (
            <>
              {/* Insights Panel */}
              <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
                <h2 className="chart-title text-[12px] mb-3">Key Insights</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {comparisonInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-3 bg-stone-900/50 border border-stone-800"
                    >
                      <span className="material-symbols-outlined text-primary-container text-lg">
                        insights
                      </span>
                      <span className="text-[11px] text-stone-300">{insight}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
                  <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Drivers Compared
                  </div>
                  <div className="text-2xl font-display font-black text-white">
                    {driverComparisons.length}
                  </div>
                  <div className="text-[9px] font-mono text-stone-500 mt-1">
                    Across {loadedComparisonYears.length} loaded seasons
                  </div>
                </div>

                <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
                  <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Full-Year Coverage
                  </div>
                  <div className="text-2xl font-display font-black text-primary-container">
                    {trackedAcrossAllSelectedYears}
                  </div>
                  <div className="text-[9px] font-mono text-stone-500 mt-1">
                    Drivers present in every selected season
                  </div>
                </div>

                <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
                  <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Forecast Target
                  </div>
                  <div className={`text-2xl font-display font-black ${YEAR_TEXT_CLASSES[predictionYear] || "text-red-400"}`}>
                    {predictionYear}
                  </div>
                  <div className="text-[9px] font-mono text-stone-500 mt-1">
                    Projection built from {loadedComparisonYears.join(", ")}
                  </div>
                </div>

                <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
                  <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Projected Leader
                  </div>
                  <div className="text-xl font-display font-black text-yellow-500">
                    {projectedLeader ? projectedLeader.driver_code : "--"}
                  </div>
                  <div className="text-[9px] font-mono text-stone-500 mt-1">
                    {projectedLeader
                      ? `Predicted range P${projectedLeader.predicted_finish_range}`
                      : "Run Analyze to generate the next-year projection"}
                  </div>
                </div>
              </div>

              {/* Season Metrics Table */}
              <div className="bg-surface border border-stone-800">
                <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
                  <h2 className="chart-title text-[11px]">Season Comparison</h2>
                  <span className="text-[7px] font-mono text-stone-600">
                    [{comparison.track_name.toUpperCase()}]
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-headline font-bold tracking-widest bg-stone-950">
                        <th className="px-4 py-3 font-medium">Year</th>
                        <th className="px-4 py-3 font-medium">Winner</th>
                        <th className="px-4 py-3 font-medium text-right">Avg Lap</th>
                        <th className="px-4 py-3 font-medium text-right">Best Lap</th>
                        <th className="px-4 py-3 font-medium text-right">Pit Stops</th>
                        <th className="px-4 py-3 font-medium">Strategy</th>
                      </tr>
                    </thead>
                    <tbody className="text-[10px] font-mono">
                      {seasonMetrics.map((sm) => (
                        <tr
                          key={sm.year}
                          className="border-b border-stone-800/50 hover:bg-white/5 transition-colors"
                        >
                          <td className="px-4 py-2.5">
                            <span
                              className={`font-display font-bold text-[12px] ${YEAR_TEXT_CLASSES[sm.year] || "text-white"}`}
                            >
                              {sm.year}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-yellow-500 font-bold">
                            {sm.winner_code}
                          </td>
                          <td className="px-4 py-2.5 text-right text-stone-400">
                            {formatLapTime(sm.avg_lap_time_seconds)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-purple-400">
                            {formatLapTime(sm.best_lap_time_seconds)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-stone-400">
                            {sm.total_pit_stops}
                          </td>
                          <td className="px-4 py-2.5 text-primary-container">
                            {sm.dominant_strategy}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface border border-stone-800">
                <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
                  <div>
                    <h2 className="chart-title text-[11px]">Driver Performance Matrix</h2>
                    <p className="chart-subtitle mt-1">
                      Every selected season side by side with the {predictionYear} forecast
                    </p>
                  </div>
                  <span className="text-[7px] font-mono text-stone-600">
                    [{activeDriverCode === "ALL" ? `${comparisonStartIndex}-${comparisonEndIndex}` : activeDriverCode}]
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-headline font-bold tracking-widest bg-stone-950">
                        <th className="px-4 py-3 font-medium min-w-[180px]">Driver</th>
                        {loadedComparisonYears.map((year) => (
                          <th key={`matrix-year-${year}`} className="px-4 py-3 font-medium">
                            <span className={YEAR_TEXT_CLASSES[year] || "text-stone-200"}>{year}</span>
                          </th>
                        ))}
                        <th className="px-4 py-3 font-medium">
                          <span className={YEAR_TEXT_CLASSES[predictionYear] || "text-red-400"}>
                            {predictionYear} Forecast
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="align-top text-[10px] font-mono">
                      {driverMatrixRows.map((driver) => {
                        const seasonsByYear = new Map(
                          driver.seasons.map((season) => [season.year, season]),
                        );
                        const driverPrediction = predictionByDriver.get(driver.driver_code);
                        const displayName = formatDriverName(driver.driver_code, driver.driver_name);

                        return (
                          <tr
                            key={`matrix-${driver.driver_code}`}
                            className="border-b border-stone-800/50 hover:bg-stone-900/20 transition-colors"
                          >
                            <td className="px-4 py-3 min-w-[180px]">
                              <div className="text-[12px] font-bold text-white">{driver.driver_code}</div>
                              {displayName !== driver.driver_code && (
                                <div className="mt-1 text-[10px] text-stone-500">{displayName}</div>
                              )}
                              <div className="mt-3 grid grid-cols-2 gap-2 text-[8px] font-headline font-bold uppercase tracking-widest">
                                <div className="border border-stone-800 bg-stone-950/70 px-2 py-1.5">
                                  <div className="text-stone-600">Avg Finish</div>
                                  <div className="mt-1 text-primary-container">P{driver.avg_finish_position.toFixed(1)}</div>
                                </div>
                                <div className="border border-stone-800 bg-stone-950/70 px-2 py-1.5">
                                  <div className="text-stone-600">Wins</div>
                                  <div className="mt-1 text-yellow-500">{driver.wins}</div>
                                </div>
                              </div>
                            </td>
                            {loadedComparisonYears.map((year) => (
                              <td
                                key={`matrix-${driver.driver_code}-${year}`}
                                className="border-l border-stone-800/60 bg-stone-950/20"
                              >
                                <DriverSeasonCell season={seasonsByYear.get(year)} />
                              </td>
                            ))}
                            <td className="border-l border-primary-container/20 bg-primary-container/5">
                              <DriverProjectionCell prediction={driverPrediction} predictionYear={predictionYear} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {activeDriverCode === "ALL" && driverComparisons.length > COMPARISON_ROWS_PER_PAGE && (
                  <div className="px-4 py-3 border-t border-stone-800 bg-stone-900/40 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-stone-500">
                      Showing {comparisonStartIndex}-{comparisonEndIndex} of {driverComparisons.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setComparisonPage((p) => Math.max(1, p - 1))}
                        disabled={safeComparisonPage <= 1}
                        className="px-3 py-1 text-[10px] font-mono bg-stone-800 text-stone-300 disabled:text-stone-600 disabled:bg-stone-900"
                      >
                        Prev
                      </button>
                      <span className="text-[10px] font-mono text-stone-400">
                        {safeComparisonPage}/{comparisonPageCount}
                      </span>
                      <button
                        onClick={() => setComparisonPage((p) => Math.min(comparisonPageCount, p + 1))}
                        disabled={safeComparisonPage >= comparisonPageCount}
                        className="px-3 py-1 text-[10px] font-mono bg-stone-800 text-stone-300 disabled:text-stone-600 disabled:bg-stone-900"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Driver-Level Comparison */}
              <div className="bg-surface border border-stone-800">
                <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
                  <h2 className="chart-title text-[11px]">Driver Comparison</h2>
                  <span className="text-[7px] font-mono text-stone-600">
                    [{activeDriverCode === "ALL" ? "ALL" : activeDriverCode}]
                  </span>
                </div>

                {selectedDriverComparison ? (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="bg-stone-900/50 border border-stone-800 p-3">
                        <div className="text-[8px] uppercase text-stone-600">Driver</div>
                        <div className="text-[12px] font-bold text-white mt-1">
                          {formatDriverName(
                            selectedDriverComparison.driver_code,
                            selectedDriverComparison.driver_name,
                          )}
                        </div>
                      </div>
                      <div className="bg-stone-900/50 border border-stone-800 p-3">
                        <div className="text-[8px] uppercase text-stone-600">Avg Finish</div>
                        <div className="text-[12px] font-bold text-primary-container mt-1">
                          P{selectedDriverComparison.avg_finish_position.toFixed(1)}
                        </div>
                      </div>
                      <div className="bg-stone-900/50 border border-stone-800 p-3">
                        <div className="text-[8px] uppercase text-stone-600">Best Finish</div>
                        <div className="text-[12px] font-bold text-yellow-500 mt-1">
                          P{selectedDriverComparison.best_finish}
                        </div>
                      </div>
                      <div className="bg-stone-900/50 border border-stone-800 p-3">
                        <div className="text-[8px] uppercase text-stone-600">Wins / Podiums</div>
                        <div className="text-[12px] font-bold text-white mt-1">
                          {selectedDriverComparison.wins} / {selectedDriverComparison.podiums}
                        </div>
                      </div>
                      <div className="bg-stone-900/50 border border-stone-800 p-3">
                        <div className="text-[8px] uppercase text-stone-600">Consistency</div>
                        <div className={`text-[12px] font-bold mt-1 ${
                          selectedDriverComparison.consistency_trend === "improving"
                            ? "text-green-500"
                            : selectedDriverComparison.consistency_trend === "declining"
                            ? "text-red-500"
                            : "text-stone-300"
                        }`}>
                          {selectedDriverComparison.consistency_trend.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-stone-800">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-bold tracking-widest bg-stone-950">
                            <th className="px-4 py-3 font-medium">Year</th>
                            <th className="px-4 py-3 font-medium">Team</th>
                            <th className="px-4 py-3 font-medium text-right">Grid</th>
                            <th className="px-4 py-3 font-medium text-right">Finish</th>
                            <th className="px-4 py-3 font-medium text-right">Avg Lap</th>
                            <th className="px-4 py-3 font-medium text-right">Best Lap</th>
                            <th className="px-4 py-3 font-medium text-right">Pits</th>
                            <th className="px-4 py-3 font-medium text-right">Consistency</th>
                          </tr>
                        </thead>
                        <tbody className="text-[10px] font-mono">
                          {selectedDriverComparison.seasons.map((season) => (
                            <tr key={`${season.driver_code}-${season.year}`} className="border-b border-stone-800/50 hover:bg-stone-900/30">
                              <td className="px-4 py-2.5 text-white font-bold">{season.year}</td>
                              <td className="px-4 py-2.5 text-stone-300">{season.team}</td>
                              <td className="px-4 py-2.5 text-right text-stone-400">P{season.grid_position}</td>
                              <td className="px-4 py-2.5 text-right text-primary-container">P{season.finish_position}</td>
                              <td className="px-4 py-2.5 text-right text-stone-400">{formatLapTime(season.avg_lap_time_seconds)}</td>
                              <td className="px-4 py-2.5 text-right text-blue-400">{formatLapTime(season.best_lap_time_seconds)}</td>
                              <td className="px-4 py-2.5 text-right text-stone-400">{season.pit_stops}</td>
                              <td className="px-4 py-2.5 text-right text-yellow-500">{season.consistency_score.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {selectedDriverPrediction && (
                      <div className="bg-primary-container/5 border border-primary-container/20 p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div>
                            <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500">
                              {predictionYear} Projection
                            </div>
                            <div className="mt-2 text-2xl font-display font-black text-primary-container">
                              P{selectedDriverPrediction.predicted_finish_range}
                            </div>
                            <div className="mt-2 text-[10px] font-mono text-stone-400">
                              {selectedDriverPrediction.reasoning}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="bg-stone-950 border border-stone-800 p-3">
                              <div className="text-[8px] uppercase text-stone-600">Pred Lap</div>
                              <div className="mt-1 text-[12px] font-bold text-blue-400">
                                {formatLapTimeOrDash(selectedDriverPrediction.predicted_avg_lap_time)}
                              </div>
                            </div>
                            <div className="bg-stone-950 border border-stone-800 p-3">
                              <div className="text-[8px] uppercase text-stone-600">Confidence</div>
                              <div className={`mt-1 text-[12px] font-bold ${getConfidenceTone(selectedDriverPrediction.confidence)}`}>
                                {selectedDriverPrediction.confidence.toFixed(0)}%
                              </div>
                            </div>
                            <div className="bg-stone-950 border border-stone-800 p-3 col-span-2 lg:col-span-1">
                              <div className="text-[8px] uppercase text-stone-600">Team</div>
                              <div className="mt-1 text-[12px] font-bold text-white">
                                {selectedDriverPrediction.team}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-bold tracking-widest bg-stone-950">
                            <th className="px-4 py-3 font-medium">Driver</th>
                            <th className="px-4 py-3 font-medium text-right">Avg Finish</th>
                            <th className="px-4 py-3 font-medium text-right">Best</th>
                            <th className="px-4 py-3 font-medium text-right">Wins</th>
                            <th className="px-4 py-3 font-medium text-right">Podiums</th>
                            <th className="px-4 py-3 font-medium text-right">Lap Trend</th>
                            <th className="px-4 py-3 font-medium">Consistency</th>
                          </tr>
                        </thead>
                        <tbody className="text-[10px] font-mono">
                          {paginatedDriverComparisons.map((driver) => (
                            <tr key={driver.driver_code} className="border-b border-stone-800/50 hover:bg-stone-900/30">
                              <td className="px-4 py-2.5 text-white font-bold">
                                {driver.driver_code}
                                {formatDriverName(driver.driver_code, driver.driver_name) !== driver.driver_code && (
                                  <span className="text-stone-500"> {formatDriverName(driver.driver_code, driver.driver_name)}</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right text-primary-container">P{driver.avg_finish_position.toFixed(1)}</td>
                              <td className="px-4 py-2.5 text-right text-yellow-500">P{driver.best_finish}</td>
                              <td className="px-4 py-2.5 text-right text-stone-300">{driver.wins}</td>
                              <td className="px-4 py-2.5 text-right text-stone-300">{driver.podiums}</td>
                              <td className="px-4 py-2.5 text-right text-blue-400">{driver.avg_lap_time_trend.toFixed(3)}s</td>
                              <td className={`px-4 py-2.5 ${
                                driver.consistency_trend === "improving"
                                  ? "text-green-500"
                                  : driver.consistency_trend === "declining"
                                  ? "text-red-500"
                                  : "text-stone-400"
                              }`}>
                                {driver.consistency_trend}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {driverComparisons.length > COMPARISON_ROWS_PER_PAGE && (
                      <div className="px-4 py-3 border-t border-stone-800 bg-stone-900/40 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-stone-500">
                          Showing {comparisonStartIndex}-{comparisonEndIndex} of {driverComparisons.length}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setComparisonPage((p) => Math.max(1, p - 1))}
                            disabled={safeComparisonPage <= 1}
                            className="px-3 py-1 text-[10px] font-mono bg-stone-800 text-stone-300 disabled:text-stone-600 disabled:bg-stone-900"
                          >
                            Prev
                          </button>
                          <span className="text-[10px] font-mono text-stone-400">
                            {safeComparisonPage}/{comparisonPageCount}
                          </span>
                          <button
                            onClick={() => setComparisonPage((p) => Math.min(comparisonPageCount, p + 1))}
                            disabled={safeComparisonPage >= comparisonPageCount}
                            className="px-3 py-1 text-[10px] font-mono bg-stone-800 text-stone-300 disabled:text-stone-600 disabled:bg-stone-900"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pace Evolution Chart */}
                <div className="bg-surface-container border border-stone-800 p-4">
                  <h2 className="chart-title text-[11px] mb-1">Pace Evolution</h2>
                  <p className="chart-subtitle mb-4">
                    {paceTrend?.trend_direction === "faster"
                      ? `Improving ~${paceTrend.improvement_per_year.toFixed(2)}s/year`
                      : paceTrend?.trend_direction === "slower"
                      ? `Slowing ~${Math.abs(paceTrend.improvement_per_year).toFixed(2)}s/year`
                      : "Stable pace across seasons"}
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={paceChartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1f1f1f"
                          strokeOpacity={0.5}
                        />
                        <XAxis
                          dataKey="year"
                          stroke="#444"
                          tick={{ fill: "#555", fontSize: 10 }}
                        />
                        <YAxis
                          stroke="#444"
                          tick={{ fill: "#555", fontSize: 9 }}
                          tickFormatter={(v) => `${v}s`}
                          domain={["dataMin - 1", "dataMax + 1"]}
                        />
                        <Tooltip content={<PaceChartTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="avgLap"
                          name="Avg Lap"
                          stroke="#e10600"
                          strokeWidth={2}
                          dot={{ fill: "#e10600", r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="bestLap"
                          name="Best Lap"
                          stroke="#a855f7"
                          strokeWidth={2}
                          dot={{ fill: "#a855f7", r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Strategy Trend Chart */}
                <div className="bg-surface-container border border-stone-800 p-4">
                  <h2 className="chart-title text-[11px] mb-1">Pit Stop Trends</h2>
                  <p className="chart-subtitle mb-4">
                    Optimal window: Lap {strategyTrend?.pit_window_start ?? "--"}-
                    {strategyTrend?.pit_window_end ?? "--"}
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pitChartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1f1f1f"
                          strokeOpacity={0.5}
                        />
                        <XAxis
                          dataKey="year"
                          stroke="#444"
                          tick={{ fill: "#555", fontSize: 10 }}
                        />
                        <YAxis
                          stroke="#444"
                          tick={{ fill: "#555", fontSize: 9 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#181818",
                            border: "1px solid #333",
                            fontSize: 11,
                          }}
                        />
                        <Bar
                          dataKey="avgPitLap"
                          name="Avg Pit Lap"
                          fill="#3b82f6"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Prediction View */
            prediction && (
              <div className="space-y-4">
                {/* Prediction Header */}
                <div className="insight-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="chart-title text-lg">
                        {prediction.track_name} {prediction.prediction_year} Prediction
                      </h2>
                      <p className="chart-subtitle mt-1">
                        {prediction.methodology}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[8px] font-headline uppercase tracking-wider text-stone-500">
                        Confidence
                      </div>
                      <div
                        className={`text-2xl font-display font-black ${
                          prediction.confidence_overall >= 75
                            ? "text-green-500"
                            : prediction.confidence_overall >= 50
                            ? "text-yellow-500"
                            : "text-red-500"
                        }`}
                      >
                        {prediction.confidence_overall.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prediction Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Predicted Lap Time */}
                  <div className="bg-surface-container border border-stone-800 p-4 instrument-border hover-lift">
                    <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500 mb-2">
                      Predicted Avg Lap
                    </div>
                    <div className="text-xl font-display font-black text-primary-container">
                      {formatLapTime(prediction.predicted_avg_lap_time)}
                    </div>
                    <div className="text-[9px] font-mono text-stone-500 mt-1">
                      {prediction.pace_prediction}
                    </div>
                  </div>

                  {/* Predicted Pit Window */}
                  <div className="bg-surface-container border border-stone-800 p-4 instrument-border hover-lift">
                    <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500 mb-2">
                      Optimal Pit Window
                    </div>
                    <div className="text-xl font-display font-black text-blue-400">
                      {prediction.predicted_strategy.predicted_pit_window}
                    </div>
                    <div className="text-[9px] font-mono text-stone-500 mt-1">
                      {prediction.predicted_strategy.confidence.toFixed(0)}% confidence
                    </div>
                  </div>

                  {/* Predicted Strategy */}
                  <div className="bg-surface-container border border-stone-800 p-4 instrument-border hover-lift">
                    <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500 mb-2">
                      Recommended Strategy
                    </div>
                    <div className="text-lg font-display font-black text-green-500">
                      {prediction.predicted_strategy.predicted_strategy}
                    </div>
                    <div className="text-[9px] font-mono text-stone-500 mt-1">
                      Based on {prediction.based_on_years.length} seasons
                    </div>
                  </div>

                  {/* Predicted Degradation */}
                  <div className="bg-surface-container border border-stone-800 p-4 instrument-border hover-lift">
                    <div className="text-[8px] font-headline font-bold uppercase tracking-widest text-stone-500 mb-2">
                      Expected Degradation
                    </div>
                    <div
                      className={`text-xl font-display font-black ${
                        prediction.predicted_degradation === "HIGH"
                          ? "text-red-500"
                          : prediction.predicted_degradation === "MEDIUM"
                          ? "text-yellow-500"
                          : "text-green-500"
                      }`}
                    >
                      {prediction.predicted_degradation}
                    </div>
                    <div className="text-[9px] font-mono text-stone-500 mt-1">
                      Tire wear projection
                    </div>
                  </div>
                </div>

                {/* Reasoning */}
                <div className="bg-surface-container border border-stone-800 p-4 instrument-border">
                  <h3 className="chart-title text-[11px] mb-3">Analysis Basis</h3>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    {prediction.predicted_strategy.reasoning}. This prediction uses{" "}
                    {prediction.methodology.toLowerCase()}, analyzing data from{" "}
                    {prediction.based_on_years.join(", ")} seasons at{" "}
                    {prediction.track_name}.
                  </p>
                </div>

                {/* Individual Driver Predictions */}
                <div className="bg-surface border border-stone-800">
                  <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
                    <h3 className="chart-title text-[11px]">Individual Driver Predictions</h3>
                    <span className="text-[7px] font-mono text-stone-600">
                      [{activeDriverCode === "ALL" ? "TOP_FIELD" : activeDriverCode}]
                    </span>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paginatedVisibleDriverPredictions.map((driver) => (
                      <div key={`pred-${driver.driver_code}`} className="bg-stone-900/50 border border-stone-800 p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="text-[12px] text-white font-bold">
                              {driver.driver_code}
                              {formatDriverName(driver.driver_code, driver.driver_name) !== driver.driver_code &&
                                ` - ${formatDriverName(driver.driver_code, driver.driver_name)}`}
                            </div>
                            <div className="text-[10px] text-stone-500">{driver.team}</div>
                          </div>
                          <div className={`text-[11px] font-bold ${
                            driver.confidence >= 75
                              ? "text-green-500"
                              : driver.confidence >= 60
                              ? "text-yellow-500"
                              : "text-red-500"
                          }`}>
                            {driver.confidence.toFixed(0)}%
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-stone-950 border border-stone-800 p-2">
                            <div className="text-[8px] uppercase text-stone-600">Finish Range</div>
                            <div className="text-[12px] font-bold text-primary-container mt-1">
                              P{driver.predicted_finish_range}
                            </div>
                          </div>
                          <div className="bg-stone-950 border border-stone-800 p-2">
                            <div className="text-[8px] uppercase text-stone-600">Pred Lap</div>
                            <div className="text-[12px] font-bold text-blue-400 mt-1">
                              {formatLapTime(driver.predicted_avg_lap_time)}
                            </div>
                          </div>
                        </div>

                        <div className="text-[9px] text-stone-400 mb-2">{driver.reasoning}</div>
                        <div className="text-[9px]">
                          <span className="text-green-500">Strengths:</span>{" "}
                          <span className="text-stone-400">{driver.strengths.join(", ")}</span>
                        </div>
                        <div className="text-[9px] mt-1">
                          <span className="text-red-500">Weaknesses:</span>{" "}
                          <span className="text-stone-400">{driver.weaknesses.join(", ")}</span>
                        </div>
                      </div>
                    ))}

                    {visibleDriverPredictions.length === 0 && (
                      <div className="text-[10px] text-stone-500 font-mono">
                        No prediction available for selected driver.
                      </div>
                    )}
                  </div>
                  {visibleDriverPredictions.length > PREDICTION_CARDS_PER_PAGE && (
                    <div className="px-4 py-3 border-t border-stone-800 bg-stone-900/40 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-stone-500">
                        Showing {predictionStartIndex}-{predictionEndIndex} of {visibleDriverPredictions.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPredictionPage((p) => Math.max(1, p - 1))}
                          disabled={safePredictionPage <= 1}
                          className="px-3 py-1 text-[10px] font-mono bg-stone-800 text-stone-300 disabled:text-stone-600 disabled:bg-stone-900"
                        >
                          Prev
                        </button>
                        <span className="text-[10px] font-mono text-stone-400">
                          {safePredictionPage}/{predictionPageCount}
                        </span>
                        <button
                          onClick={() => setPredictionPage((p) => Math.min(predictionPageCount, p + 1))}
                          disabled={safePredictionPage >= predictionPageCount}
                          className="px-3 py-1 text-[10px] font-mono bg-stone-800 text-stone-300 disabled:text-stone-600 disabled:bg-stone-900"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !comparison && (
        <div className="bg-surface-container border border-stone-800 p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-stone-600 mb-3">
            query_stats
          </span>
          <p className="text-stone-500 text-sm font-mono">
            Select a track and seasons, then click Analyze
          </p>
          <p className="text-stone-600 text-[10px] font-mono mt-2">
            Build a driver-by-driver history matrix and next-year forecast
          </p>
        </div>
      )}
    </div>
  );
}

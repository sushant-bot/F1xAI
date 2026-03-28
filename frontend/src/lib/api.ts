export type RaceLoadResponse = {
  session_id: string;
  race_name: string;
  cached: boolean;
  load_time_ms: number;
};

export type RaceOverview = {
  session_id: string;
  metrics: {
    race_name: string;
    date: string;
    track_name: string;
    total_drivers: number;
    total_laps: number;
    avg_lap_time_seconds: number;
    race_duration_seconds?: number | null;
  };
  lap_times: Array<{
    driver_code: string;
    driver_name: string;
    lap_number: number;
    lap_time_seconds: number;
  }>;
  race_results: Array<{
    position: number;
    grid_position: number;
    driver_code: string;
    driver_name: string;
    headshot_url?: string | null;
    points: number;
    status: string;
    laps_completed: number;
    time_diff_seconds?: number | null;
  }>;
  pit_strategies: Array<{
    driver_code: string;
    driver_name: string;
    lap_number: number;
    compound: string;
    duration_seconds: number;
  }>;
  tire_compounds: Array<{
    compound: string;
    count: number;
    percentage: number;
  }>;
  best_laps: Array<{
    driver_code: string;
    driver_name: string;
    best_lap_time_seconds: number;
    lap_number: number;
  }>;
};

function resolveDefaultApiBase(): string {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000/api/v1";
  }

  const { hostname, port } = window.location;
  const numericPort = Number(port);
  const derivedBackendPort =
    Number.isFinite(numericPort) && numericPort >= 3000 && numericPort < 4000
      ? String(numericPort + 5000)
      : "8000";

  return `http://${hostname}:${derivedBackendPort}/api/v1`;
}

const DEFAULT_API_BASE = resolveDefaultApiBase();

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_API_BASE;

type FetchRaceOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

function withTimeoutSignal(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeout);
      controller.abort();
    } else {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          controller.abort();
        },
        { once: true },
      );
    }
  }

  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeout);
    },
    { once: true },
  );

  return controller.signal;
}

export async function fetchOverviewRace(
  year = 2023,
  event = "Bahrain Grand Prix",
  sessionType = "Race",
  options: FetchRaceOptions = {},
): Promise<RaceOverview> {
  const timeoutMs = options.timeoutMs ?? 30000;
  const signal = withTimeoutSignal(timeoutMs, options.signal);

  const params = new URLSearchParams({
    year: String(year),
    event,
    session_type: sessionType,
  });

  const loadResponse = await fetch(`${API_BASE}/races/load?${params.toString()}`, {
    signal,
  });
  if (!loadResponse.ok) {
    throw new Error(`Failed to load race data (${loadResponse.status})`);
  }

  const loadData: RaceLoadResponse = await loadResponse.json();

  const overviewResponse = await fetch(
    `${API_BASE}/races/${loadData.session_id}/overview`,
    {
      signal,
    },
  );
  if (!overviewResponse.ok) {
    throw new Error(`Failed to fetch race overview (${overviewResponse.status})`);
  }

  return overviewResponse.json();
}

// ============================================================================
// MULTI-SEASON COMPARISON TYPES
// ============================================================================

export type SeasonMetrics = {
  year: number;
  avg_lap_time_seconds: number;
  best_lap_time_seconds: number;
  winner_code: string;
  winner_name: string;
  total_pit_stops: number;
  avg_pit_lap: number;
  dominant_strategy: string;
  avg_degradation_rate: number;
  safety_cars: number;
};

export type StrategyTrend = {
  avg_first_pit_lap: number;
  pit_window_start: number;
  pit_window_end: number;
  most_common_compounds: string[];
  strategy_shift: string;
};

export type PaceTrend = {
  years: number[];
  avg_lap_times: number[];
  improvement_per_year: number;
  trend_direction: string;
};

export type DegradationTrend = {
  years: number[];
  avg_degradation_rates: number[];
  trend: string;
};

// ============================================================================
// DRIVER COMPARISON TYPES
// ============================================================================

export type DriverSeasonPerformance = {
  year: number;
  driver_code: string;
  driver_name: string;
  team: string;
  grid_position: number;
  finish_position: number;
  points: number;
  avg_lap_time_seconds: number;
  best_lap_time_seconds: number;
  consistency_score: number;
  pit_stops: number;
  laps_completed: number;
  status: string;
};

export type DriverComparison = {
  driver_code: string;
  driver_name: string;
  seasons: DriverSeasonPerformance[];
  avg_finish_position: number;
  best_finish: number;
  worst_finish: number;
  podiums: number;
  wins: number;
  avg_lap_time_trend: number;
  consistency_trend: string;
};

export type DriverPredictionResult = {
  driver_code: string;
  driver_name: string;
  team: string;
  predicted_finish_range: string;
  predicted_avg_lap_time: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  reasoning: string;
};

export type TrackComparisonResponse = {
  track_name: string;
  years: number[];
  season_metrics: SeasonMetrics[];
  driver_comparisons: DriverComparison[];
  strategy_trend: StrategyTrend;
  pace_trend: PaceTrend;
  degradation_trend: DegradationTrend;
  insights: string[];
};

export type PredictedStrategy = {
  predicted_pit_window: string;
  predicted_strategy: string;
  confidence: number;
  reasoning: string;
};

export type TrendPredictionResponse = {
  track_name: string;
  prediction_year: number;
  based_on_years: number[];
  predicted_avg_lap_time: number;
  predicted_degradation: string;
  predicted_strategy: PredictedStrategy;
  pace_prediction: string;
  driver_predictions: DriverPredictionResult[];
  confidence_overall: number;
  methodology: string;
};

// ============================================================================
// METADATA TYPES
// ============================================================================

export type DriverMetadata = {
  name: string;
  number: number;
  team: string;
  nationality: string;
  color: string;
  headshot_url?: string | null;
};

export type TeamMetadata = {
  color: string;
  engine: string;
};

export type MetadataResponse = {
  drivers: Record<string, DriverMetadata>;
  teams: Record<string, TeamMetadata>;
  tracks?: Record<string, { name: string; country: string; laps: number; length_km: number }>;
};

// ============================================================================
// COMPARISON API FUNCTIONS
// ============================================================================

export async function fetchTrackComparison(
  track: string,
  event: string,
  years: number[],
  options: FetchRaceOptions = {},
): Promise<TrackComparisonResponse> {
  const timeoutMs = options.timeoutMs ?? 120000; // Longer timeout for multi-year loading
  const signal = withTimeoutSignal(timeoutMs, options.signal);

  const params = new URLSearchParams({
    track,
    event,
    years: years.join(","),
  });

  const response = await fetch(`${API_BASE}/races/compare?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch track comparison (${response.status})`);
  }

  return response.json();
}

export async function fetchTrendPrediction(
  track: string,
  event: string,
  years: number[],
  predictionYear: number,
  options: FetchRaceOptions = {},
): Promise<TrendPredictionResponse> {
  const timeoutMs = options.timeoutMs ?? 120000;
  const signal = withTimeoutSignal(timeoutMs, options.signal);

  const params = new URLSearchParams({
    track,
    event,
    years: years.join(","),
    prediction_year: String(predictionYear),
  });

  const response = await fetch(`${API_BASE}/races/predict?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch prediction (${response.status})`);
  }

  return response.json();
}

// ============================================================================
// METADATA API FUNCTION
// ============================================================================

export async function fetchMetadata(
  options: FetchRaceOptions = {},
): Promise<MetadataResponse> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const signal = withTimeoutSignal(timeoutMs, options.signal);

  const response = await fetch(`${API_BASE}/races/metadata`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata (${response.status})`);
  }

  return response.json();
}

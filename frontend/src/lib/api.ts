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

const DEFAULT_API_BASE =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000/api/v1`
    : "http://127.0.0.1:8000/api/v1";

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

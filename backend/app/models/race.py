from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class DriverLapTime(BaseModel):
    driver_code: str
    driver_name: str
    lap_number: int
    lap_time_seconds: float


class RaceResult(BaseModel):
    position: int
    grid_position: int
    driver_code: str
    driver_name: str
    headshot_url: Optional[str] = None
    points: float
    status: str
    laps_completed: int
    time_diff_seconds: Optional[float] = None


class PitStop(BaseModel):
    driver_code: str
    driver_name: str
    lap_number: int
    compound: str
    duration_seconds: float


class TireCompound(BaseModel):
    compound: str
    count: int
    percentage: float


class DriverBestLap(BaseModel):
    driver_code: str
    driver_name: str
    best_lap_time_seconds: float
    lap_number: int


class RaceOverviewMetrics(BaseModel):
    race_name: str
    date: str
    track_name: str
    total_drivers: int
    total_laps: int
    avg_lap_time_seconds: float
    race_duration_seconds: Optional[float] = None


class RaceOverview(BaseModel):
    session_id: str
    metrics: RaceOverviewMetrics
    lap_times: List[DriverLapTime]
    race_results: List[RaceResult]
    pit_strategies: List[PitStop]
    tire_compounds: List[TireCompound]
    best_laps: List[DriverBestLap]


class RaceLoadResponse(BaseModel):
    session_id: str
    race_name: str
    cached: bool
    load_time_ms: int


class RaceOverviewResponse(BaseModel):
    session_id: str
    metrics: RaceOverviewMetrics
    lap_times: List[DriverLapTime]
    race_results: List[RaceResult]
    pit_strategies: List[PitStop]
    tire_compounds: List[TireCompound]
    best_laps: List[DriverBestLap]


class ErrorResponse(BaseModel):
    detail: str
    status_code: int


# ============================================================================
# PREDICTIONS MODELS
# ============================================================================

class FeatureImportance(BaseModel):
    feature: str
    importance: float


class ModelMetrics(BaseModel):
    mae: float
    rmse: float
    r2: float


class LapPrediction(BaseModel):
    lap_number: int
    actual_time_seconds: float
    predicted_time_seconds: float
    error_seconds: float


class DriverPrediction(BaseModel):
    driver_code: str
    driver_name: str
    predictions: List[LapPrediction]
    avg_error_seconds: float


class PredictionResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    session_id: str
    model_type: str  # "xgboost" or "random_forest"
    model_metrics: ModelMetrics
    feature_importance: List[FeatureImportance]
    driver_predictions: List[DriverPrediction]


# ============================================================================
# DRIVER ANALYSIS MODELS
# ============================================================================

class StintAnalysis(BaseModel):
    stint_number: int
    compound: str
    lap_start: int
    lap_end: int
    lap_count: int
    avg_lap_time_seconds: float
    best_lap_time_seconds: float
    degradation_rate: float  # sec/lap


class DriverPaceMetrics(BaseModel):
    avg_lap_time_seconds: float
    best_lap_time_seconds: float
    std_lap_time_seconds: float
    consistency_score: float  # 0-100


class DriverAnalysisResponse(BaseModel):
    session_id: str
    driver_code: str
    driver_name: str
    team: Optional[str] = None
    grid_position: int
    final_position: int
    points: float
    pace_metrics: DriverPaceMetrics
    stints: List[StintAnalysis]
    lap_times: List[DriverLapTime]


# ============================================================================
# STRATEGY MODELS
# ============================================================================

class PitRecommendation(BaseModel):
    stint: int
    compound: str
    lap_count: int
    degradation_rate: float
    time_spread: float
    recommended_pit_lap: int
    reason: str


class EnergyPhase(BaseModel):
    lap_start: int
    lap_end: int
    mode: str  # "boost", "neutral", "conserve"


class DriverStrategy(BaseModel):
    driver_code: str
    driver_name: str
    current_position: int
    grid_position: int
    pit_recommendations: List[PitRecommendation]
    energy_strategy: List[EnergyPhase]
    strategy_summary: str


class StrategyResponse(BaseModel):
    session_id: str
    race_length: int
    strategies: List[DriverStrategy]


# ============================================================================
# SIMULATION MODELS
# ============================================================================

class SimulationLap(BaseModel):
    lap_number: int
    original_time_seconds: float
    simulated_time_seconds: float
    energy_mode: str
    energy_change: float
    time_adjustment: float
    energy_state: float


class SimulationResult(BaseModel):
    driver_code: str
    driver_name: str
    laps: List[SimulationLap]
    total_time_original: float
    total_time_simulated: float
    time_gained_seconds: float
    boost_laps: int
    conserve_laps: int
    final_energy: float


class SimulationRequest(BaseModel):
    driver_code: str
    strategy: List[EnergyPhase]


class SimulationResponse(BaseModel):
    session_id: str
    results: List[SimulationResult]
    summary: str


# ============================================================================
# MULTI-SEASON COMPARISON MODELS
# ============================================================================

class SeasonMetrics(BaseModel):
    """Metrics for a single season at a track."""
    year: int
    avg_lap_time_seconds: float
    best_lap_time_seconds: float
    winner_code: str
    winner_name: str
    total_pit_stops: int
    avg_pit_lap: float
    dominant_strategy: str  # e.g., "Medium → Hard"
    avg_degradation_rate: float
    safety_cars: int


class StrategyTrend(BaseModel):
    """Strategy patterns across seasons."""
    avg_first_pit_lap: float
    pit_window_start: int
    pit_window_end: int
    most_common_compounds: List[str]
    strategy_shift: str  # "earlier" / "later" / "stable"


class PaceTrend(BaseModel):
    """Pace evolution across seasons."""
    years: List[int]
    avg_lap_times: List[float]
    improvement_per_year: float  # seconds
    trend_direction: str  # "faster" / "slower" / "stable"


class DegradationTrend(BaseModel):
    """Tire degradation trends."""
    years: List[int]
    avg_degradation_rates: List[float]
    trend: str  # "higher" / "lower" / "stable"


class TrackComparisonResponse(BaseModel):
    """Multi-season track comparison."""
    track_name: str
    years: List[int]
    season_metrics: List[SeasonMetrics]
    strategy_trend: StrategyTrend
    pace_trend: PaceTrend
    degradation_trend: DegradationTrend
    insights: List[str]


# ============================================================================
# TREND PREDICTION MODELS
# ============================================================================

class PredictedStrategy(BaseModel):
    """Predicted optimal strategy for next race."""
    predicted_pit_window: str  # e.g., "Lap 17-20"
    predicted_strategy: str  # e.g., "Medium → Hard"
    confidence: float  # 0-100
    reasoning: str


class TrendPredictionResponse(BaseModel):
    """Trend-based predictions for next race."""
    track_name: str
    prediction_year: int
    based_on_years: List[int]
    predicted_avg_lap_time: float
    predicted_degradation: str  # "HIGH" / "MEDIUM" / "LOW"
    predicted_strategy: PredictedStrategy
    pace_prediction: str
    confidence_overall: float
    methodology: str


# ============================================================================
# DRIVER-LEVEL COMPARISON MODELS
# ============================================================================

class DriverSeasonPerformance(BaseModel):
    """A driver's performance in a single season at a track."""
    year: int
    driver_code: str
    driver_name: str
    team: str
    grid_position: int
    finish_position: int
    points: float
    avg_lap_time_seconds: float
    best_lap_time_seconds: float
    consistency_score: float  # 0-100 based on lap time variance
    pit_stops: int
    laps_completed: int
    status: str  # "Finished", "DNF", etc.


class DriverComparison(BaseModel):
    """A driver's performance across multiple seasons at a track."""
    driver_code: str
    driver_name: str
    seasons: List[DriverSeasonPerformance]
    avg_finish_position: float
    best_finish: int
    worst_finish: int
    podiums: int
    wins: int
    avg_lap_time_trend: float  # positive = getting slower, negative = improving
    consistency_trend: str  # "improving" / "declining" / "stable"


class DriverPredictionResult(BaseModel):
    """Predicted performance for a specific driver."""
    driver_code: str
    driver_name: str
    team: str
    predicted_finish_range: str  # e.g., "1-3" or "5-8"
    predicted_avg_lap_time: float
    confidence: float
    strengths: List[str]
    weaknesses: List[str]
    reasoning: str


class TrackComparisonResponse(BaseModel):
    """Multi-season track comparison with driver details."""
    track_name: str
    years: List[int]
    season_metrics: List[SeasonMetrics]
    driver_comparisons: List[DriverComparison]
    strategy_trend: StrategyTrend
    pace_trend: PaceTrend
    degradation_trend: DegradationTrend
    insights: List[str]


class TrendPredictionWithDriversResponse(BaseModel):
    """Trend-based predictions including individual drivers."""
    track_name: str
    prediction_year: int
    based_on_years: List[int]
    predicted_avg_lap_time: float
    predicted_degradation: str
    predicted_strategy: PredictedStrategy
    pace_prediction: str
    driver_predictions: List[DriverPredictionResult]
    confidence_overall: float
    methodology: str


# ============================================================================
# METADATA MODELS
# ============================================================================

class DriverMetadata(BaseModel):
    """Driver metadata for UI display."""
    code: str
    name: str
    number: int
    team: str
    nationality: str
    color: str


class TeamMetadata(BaseModel):
    """Team metadata for UI display."""
    name: str
    color: str
    secondary_color: Optional[str] = None
    engine: str


class MetadataResponse(BaseModel):
    """Complete metadata response."""
    drivers: dict  # code -> DriverMetadata
    teams: dict  # team_name -> TeamMetadata

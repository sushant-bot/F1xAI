from typing import List, Optional
from pydantic import BaseModel


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

from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"

# Create cache directory if it doesn't exist
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Project settings
PROJECT_NAME = "Apex26 API"
VERSION = "0.1.0"
DESCRIPTION = "FastAPI backend for F1 race analysis and predictions"
API_V1_PREFIX = "/api/v1"
DEBUG_MODE = True

# CORS settings
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]

# Cache settings
CACHE_TTL_SECONDS = 3600  # 1 hour

# FastF1 settings
FASTF1_CACHE_DIR = CACHE_DIR / "fastf1_http_cache.sqlite"
FASTF1_CACHE_ENABLED = True
FASTF1_SHOW_WARNINGS = False

# Primary race for MVP
PRIMARY_RACE = {
    "year": 2023,
    "event": "Bahrain Grand Prix",
    "session_type": "Race"
}

# Quality filter thresholds
QUALITY_FILTERS = {
    "require_accurate": True,        # Exclude inaccurate timing
    "require_not_deleted": True,     # Exclude deleted laps
    "exclude_generated": True,       # Exclude FastF1-generated data
    "green_flag_only": True,         # Exclude yellow/red flag laps
    "exclude_pit_laps": True,        # Exclude in/out laps for pace analysis
}

# ML Model Configuration
STANDARDIZE_FEATURES = True
N_SPLITS_CROSS_VAL = 3

# XGBoost hyperparameters
XGBOOST_PARAMS = {
    "max_depth": 5,
    "learning_rate": 0.1,
    "n_estimators": 100,
    "random_state": 42,
    "objective": "reg:squarederror",
    "verbosity": 0,
    "tree_method": "hist",
}

# Random Forest hyperparameters
RANDOM_FOREST_PARAMS = {
    "n_estimators": 100,
    "max_depth": 8,
    "random_state": 42,
    "n_jobs": -1,
}

# Simulation Configuration
# Energy model rules (in seconds/lap)
ENERGY_MODEL = {
    "harvest_neutral": 0,      # Neutral mode: no energy change, no time penalty
    "harvest_conserve": +1,    # Conserve mode: +1 energy/lap
    "time_conserve": +0.1,     # Conserve mode: +0.1 sec/lap penalty
    "cost_boost": -3,          # Boost mode: -3 energy/lap
    "time_boost": -0.3,        # Boost mode: -0.3 sec/lap gain
    "initial_energy": 50,      # Initial energy pool at start of race
}

# Strategy engine heuristics
STRATEGY_PARAMS = {
    "tire_degradation_threshold": 0.5,  # sec/lap increase triggers pit consideration
    "tire_gain_threshold": 1.0,         # sec gain from fresh tire to consider pit
    "position_gap_push": 2,             # If within 2 places of leader, push early
    "position_gap_conserve": 5,         # If >5 places behind, conserve early
    "push_phase_start": 40,             # Default: start pushing from lap 40
    "push_phase_length": 17,            # Default: push final 17 laps
}

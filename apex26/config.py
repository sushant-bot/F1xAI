"""
Configuration and constants for Apex26.
Centralize race selection, model hyperparameters, paths, and simulation rules.
"""

import os
from pathlib import Path

# ===== Paths =====
PROJECT_ROOT = Path(__file__).parent
DATA_DIR = PROJECT_ROOT / "data"
CACHE_DIR = DATA_DIR / "cache"
MODELS_DIR = PROJECT_ROOT / "models"
RESULTS_DIR = PROJECT_ROOT / "results"

# Create directories if they don't exist
CACHE_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# ===== Race Selection =====
# Primary race for MVP
PRIMARY_RACE = {
    "year": 2023,
    "event": "Bahrain Grand Prix",
    "session_type": "Race"
}

# Backtesting races
BACKTESTING_RACES = [
    {"year": 2023, "event": "Saudi Arabian Grand Prix", "session_type": "Race"},
    {"year": 2023, "event": "Australian Grand Prix", "session_type": "Race"},
    {"year": 2023, "event": "Azerbaijan Grand Prix", "session_type": "Race"},
    {"year": 2023, "event": "Japanese Grand Prix", "session_type": "Race"},
]

# ===== Data Pipeline =====
# FastF1 caching and loading
FASTF1_CACHE_ENABLED = True
FASTF1_SHOW_WARNINGS = False

# Quality filter thresholds
QUALITY_FILTERS = {
    "require_accurate": True,        # Exclude inaccurate timing
    "require_not_deleted": True,     # Exclude deleted laps
    "exclude_generated": True,       # Exclude FastF1-generated data
    "green_flag_only": True,         # Exclude yellow/red flag laps
    "exclude_pit_laps": True,        # Exclude in/out laps for pace analysis
}

# ===== ML Model Configuration =====
# XGBoost hyperparameters
XGBOOST_PARAMS = {
    "max_depth": 5,
    "learning_rate": 0.1,
    "n_estimators": 100,
    "random_state": 42,
    "objective": "reg:squarederror",  # Regression for lap time prediction
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

# Train/validation split
TRAIN_TEST_SPLIT = 0.8  # 80% train, 20% test on single race
N_SPLITS_CROSS_VAL = 3  # Time series splits for cross-validation

# Feature standardization
STANDARDIZE_FEATURES = True

# ===== Simulation Configuration =====
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

# ===== Dashboard Configuration =====
STREAMLIT_CONFIG = {
    "page_title": "Apex26: F1 Race Strategy Simulator",
    "page_icon": "🏎️",
    "layout": "wide",
    "initial_sidebar_state": "expanded",
}

# Chart settings
CHART_CONFIG = {
    "line_width": 2,
    "point_size": 50,
    "opacity": 0.8,
}

# ===== Prediction Targets =====
# What we're trying to predict
PREDICTION_TARGETS = {
    "lap_time": "Predicted lap time (seconds)",
    "position": "Predicted finishing position",
    "dnf_risk": "DNF (Did Not Finish) probability",
}

# Feature categories for explainability
FEATURE_CATEGORIES = {
    "driver_performance": ["DriverPace", "DriverConsistency"],
    "tire": ["TyreLife", "Compound", "TyreDegradation"],
    "track_position": ["GridPosition", "CurrentPosition", "GapToLeader"],
    "strategy": ["PitStops", "FuelLoad"],
}

# ===== Logging & Debug =====
DEBUG_MODE = False
VERBOSE = True
RANDOM_SEED = 42

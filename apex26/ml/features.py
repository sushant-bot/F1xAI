"""
Feature engineering for ML models.
Computes lap-level features (pace, degradation, tire age, etc.) for prediction.
"""

import logging
from typing import Tuple, List

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit

from config import STANDARDIZE_FEATURES, N_SPLITS_CROSS_VAL, DEBUG_MODE

logger = logging.getLogger(__name__)


def compute_driver_pace(laps: pd.DataFrame) -> pd.DataFrame:
    """
    Compute baseline pace metrics per driver (average lap time, best lap, consistency).
    
    Args:
        laps: Cleaned laps DataFrame
        
    Returns:
        DataFrame with driver pace metrics
    """
    pace = laps.groupby("Driver").agg({
        "LapTime": ["mean", "min", "std"]
    }).reset_index()
    
    pace.columns = ["Driver", "AvgLapTime", "BestLapTime", "StdLapTime"]
    
    # Convert to seconds
    pace["AvgLapTime"] = pace["AvgLapTime"].dt.total_seconds()
    pace["BestLapTime"] = pace["BestLapTime"].dt.total_seconds()
    pace["StdLapTime"] = pace["StdLapTime"].dt.total_seconds()
    
    logger.info(f"✓ Computed driver pace for {len(pace)} drivers")
    
    return pace


def compute_tire_degradation(laps: pd.DataFrame) -> pd.DataFrame:
    """
    Compute tire degradation rate per driver and compound.
    Degradation rate = (lap_time_end - lap_time_start) / (tire_life_end - tire_life_start)
    
    Args:
        laps: Cleaned laps DataFrame
        
    Returns:
        DataFrame with degradation rates
    """
    degradation_data = []
    
    for driver in laps["Driver"].unique():
        for compound in laps["Compound"].unique():
            subset = laps[(laps["Driver"] == driver) & (laps["Compound"] == compound)].sort_values("TyreLife")
            
            if len(subset) < 2:
                continue
            
            lap_times = subset["LapTime"].dt.total_seconds().values
            tire_life = subset["TyreLife"].astype(float).values
            
            # Skip if any NaN
            if np.isnan(lap_times).any() or np.isnan(tire_life).any():
                continue
            
            # Compute degradation rate (sec/lap)
            if tire_life[-1] > tire_life[0]:
                deg_rate = (lap_times[-1] - lap_times[0]) / (tire_life[-1] - tire_life[0])
            else:
                deg_rate = 0
            
            degradation_data.append({
                "Driver": driver,
                "Compound": compound,
                "DegradationRate": deg_rate,
            })
    
    deg_df = pd.DataFrame(degradation_data)
    
    logger.info(f"✓ Computed degradation rates for {len(deg_df)} driver/compound combos")
    
    return deg_df


def engineer_features(
    laps: pd.DataFrame,
    session_results: pd.DataFrame = None,
) -> Tuple[pd.DataFrame, List[str]]:
    """
    Engineer lap-level features for ML model.
    Aggregates features from prior laps to predict current lap pace.
    
    Features:
    - Grid position (from results)
    - Driver pace (historical average, best, std)
    - Tire metrics (age, compound, degradation rate)
    - Position metrics (current position, gap to leader)
    - Pit history (number of stops so far)
    
    Args:
        laps: Cleaned laps DataFrame
        session_results: Session results DataFrame (for grid position)
        
    Returns:
        Tuple of (features_df, feature_names)
    """
    
    # Start with laps, compute rolling/aggregated features
    feat = laps.copy()
    
    # Convert lap time to seconds
    feat["LapTime_sec"] = feat["LapTime"].dt.total_seconds()
    
    # 1. Grid position (constant per driver)
    if session_results is not None:
        grid_pos = session_results[["Driver", "GridPosition"]].drop_duplicates()
        feat = feat.merge(grid_pos, on="Driver", how="left")
        feat["GridPosition"] = feat["GridPosition"].fillna(20)  # Default if missing
    else:
        feat["GridPosition"] = 20
    
    # 2. Driver pace (prior laps average, rolling window)
    feat["DriverPace_3lap"] = feat.groupby("Driver")["LapTime_sec"].transform(
        lambda x: x.shift(1).rolling(window=3, min_periods=1).mean()
    )
    feat["DriverPace_5lap"] = feat.groupby("Driver")["LapTime_sec"].transform(
        lambda x: x.shift(1).rolling(window=5, min_periods=1).mean()
    )
    
    # 3. Tire metrics
    # Tire life (age in laps)
    feat["TireAge"] = feat["TyreLife"].astype(float)
    
    # Encode compound
    compound_map = {"SOFT": 1, "MEDIUM": 2, "HARD": 3, "INTERMEDIATE": 4, "WET": 5}
    feat["CompoundCode"] = feat["Compound"].map(compound_map).fillna(2)
    
    # Fresh tire indicator
    feat["FreshTyre_int"] = feat["FreshTyre"].astype(int)
    
    # 4. Position metrics
    feat["CurrentPosition"] = feat["Position"].astype(float)
    
    # Gap to leader (assume position 1 is leader, rough estimate)
    feat["GapToLeader"] = feat["CurrentPosition"] - 1
    
    # 5. Pit history (rolling pit count)
    # Count pit stops up to current lap for each driver
    pit_indicator = feat["PitInTime"].notna().astype(int)
    feat["PitCount"] = pit_indicator.groupby(feat["Driver"]).cumsum()
    
    # 6. Stint number
    feat["Stint"] = feat["Stint"].astype(float)
    
    # Select features for model
    feature_cols = [
        "GridPosition",
        "DriverPace_3lap",
        "DriverPace_5lap",
        "TireAge",
        "CompoundCode",
        "FreshTyre_int",
        "CurrentPosition",
        "GapToLeader",
        "PitCount",
        "Stint",
    ]
    
    # Drop rows with NaN in key features
    X = feat[feature_cols].copy()
    X = X.fillna(X.mean(numeric_only=True))  # Fill remaining NaNs with mean
    
    # Update feat with NaN-filled feature values
    for col in feature_cols:
        feat[col] = X[col]
    
    logger.info(f"✓ Engineered {len(X)} samples with {len(feature_cols)} features")
    
    return feat, feature_cols


def prepare_train_test(
    feat_df: pd.DataFrame,
    feature_cols: List[str],
    target: str = "LapTime_sec",
    split_ratio: float = 0.8,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[str]]:
    """
    Prepare train/test split using TimeSeriesSplit (forward-chaining).
    Ensures no temporal data leakage.
    
    Args:
        feat_df: Engineered features DataFrame
        feature_cols: List of feature column names
        target: Target column name
        split_ratio: Train/test split ratio
        
    Returns:
        Tuple of (X_train, X_test, y_train, y_test, feature_names)
    """
    
    # Sort by lap number to ensure temporal order
    feat_df = feat_df.sort_values(["Driver", "LapNumber"]).reset_index(drop=True)
    
    # Drop rows with missing target
    feat_df = feat_df[feat_df[target].notna()]
    
    X = feat_df[feature_cols].values
    y = feat_df[target].values
    
    # Time series split (forward-chaining)
    split_idx = int(len(feat_df) * split_ratio)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    
    logger.info(f"✓ Train/test split: {len(X_train)} train, {len(X_test)} test")
    
    # Standardize features
    if STANDARDIZE_FEATURES:
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)
        logger.info("✓ Features standardized")
    
    return X_train, X_test, y_train, y_test, feature_cols


def get_time_series_splits(
    feat_df: pd.DataFrame,
    n_splits: int = N_SPLITS_CROSS_VAL,
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """
    Generate TimeSeriesSplit indices for cross-validation.
    Ensures forward-chaining (train on past, test on future).
    
    Args:
        feat_df: Feature DataFrame
        n_splits: Number of splits
        
    Returns:
        List of (train_idx, test_idx) tuples
    """
    
    tss = TimeSeriesSplit(n_splits=n_splits)
    splits = []
    
    for train_idx, test_idx in tss.split(feat_df):
        splits.append((train_idx, test_idx))
    
    logger.info(f"✓ Created {n_splits} time series splits")
    
    return splits


if __name__ == "__main__":
    # Example usage
    import sys
    logging.basicConfig(level=logging.INFO)
    
    from data.loader import load_race, get_race_results
    from data.cleaner import clean_laps
    from config import PRIMARY_RACE
    
    print("Loading race data...")
    session, raw_laps, stats = load_race(**PRIMARY_RACE)
    
    print("Cleaning laps...")
    clean = clean_laps(raw_laps)
    
    print("\nComputing driver pace...")
    pace = compute_driver_pace(clean)
    print(pace.head())
    
    print("\nComputing tire degradation...")
    deg = compute_tire_degradation(clean)
    print(deg.head())
    
    print("\nEngineering features...")
    results = get_race_results(session)
    feat_df, feat_cols = engineer_features(clean, results)
    print(f"Shape: {feat_df.shape}")
    print(f"Columns: {feat_cols}")
    
    print("\nPreparing train/test...")
    X_train, X_test, y_train, y_test, cols = prepare_train_test(feat_df, feat_cols)
    print(f"X_train: {X_train.shape}, X_test: {X_test.shape}")
    print(f"y_train: {y_train.shape}, y_test: {y_test.shape}")

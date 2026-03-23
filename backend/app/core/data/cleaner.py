"""
Data cleaning and quality filtering for F1 lap data.
Removes pit laps, filters by accuracy, and validates data integrity.
"""

import logging
from typing import Dict, Tuple

import pandas as pd

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.config import QUALITY_FILTERS

logger = logging.getLogger(__name__)


def clean_laps(laps: pd.DataFrame) -> pd.DataFrame:
    """
    Apply quality filters to lap data.
    Removes pit laps, inaccurate timing, deleted laps, and synthetic data.
    
    Args:
        laps: Raw laps DataFrame from FastF1
        
    Returns:
        Cleaned laps DataFrame
    """
    initial_count = len(laps)
    
    # Step 1: Remove pit laps (in-laps and out-laps corrupt pace metrics)
    if QUALITY_FILTERS["exclude_pit_laps"]:
        laps = laps.pick_wo_box()
        logger.info(f"After removing pit laps: {len(laps)} laps ({len(laps)} - {initial_count - len(laps)} pit)")
    
    # Step 2: Filter by accuracy
    if QUALITY_FILTERS["require_accurate"]:
        initial = len(laps)
        laps = laps[laps["IsAccurate"] == True]
        logger.info(f"After filtering inaccurate: {len(laps)} laps ({initial - len(laps)} removed)")
    
    # Step 3: Remove deleted laps
    if QUALITY_FILTERS["require_not_deleted"]:
        initial = len(laps)
        laps = laps[laps["Deleted"] == False]
        logger.info(f"After removing deleted: {len(laps)} laps ({initial - len(laps)} removed)")
    
    # Step 4: Exclude FastF1-generated (synthetic) data
    if QUALITY_FILTERS["exclude_generated"]:
        initial = len(laps)
        laps = laps[laps["FastF1Generated"] == False]
        logger.info(f"After removing FastF1Generated: {len(laps)} laps ({initial - len(laps)} removed)")
    
    # Step 5: Green flag only (exclude yellow/red flag laps)
    if QUALITY_FILTERS["green_flag_only"]:
        initial = len(laps)
        laps = laps[laps["TrackStatus"] == "1"]
        logger.info(f"After filtering green flag: {len(laps)} laps ({initial - len(laps)} removed)")
    
    # Step 6: Check for missing critical columns
    critical_cols = ["Driver", "LapNumber", "LapTime", "Compound", "TyreLife", "Position"]
    for col in critical_cols:
        missing = laps[col].isna().sum()
        if missing > 0:
            logger.warning(f"Found {missing} missing values in {col}")
    
    # Reset index
    laps = laps.reset_index(drop=True)
    
    logger.info(f"✓ Cleaned laps: {len(laps)} / {initial_count} ({100*len(laps)/initial_count:.1f}%)")
    
    return laps


def get_driver_stats(laps: pd.DataFrame) -> pd.DataFrame:
    """
    Compute aggregate statistics per driver.
    
    Args:
        laps: Cleaned laps DataFrame
        
    Returns:
        DataFrame with driver statistics
    """
    stats = laps.groupby("Driver").agg({
        "LapNumber": "count",
        "LapTime": ["mean", "min", "max", "std"],
        "Position": ["mean", "min"],
        "Compound": lambda x: list(x.unique()),
    }).reset_index()
    
    stats.columns = ["Driver", "LapCount", "AvgLapTime", "BestLapTime", "WorstLapTime", "StdLapTime", "AvgPosition", "BestPosition", "Compounds"]
    
    # Convert lap times to seconds
    for col in ["AvgLapTime", "BestLapTime", "WorstLapTime", "StdLapTime"]:
        stats[col] = stats[col].dt.total_seconds()
    
    stats = stats.sort_values("AvgLapTime")
    
    logger.info(f"✓ Driver stats: {len(stats)} drivers")
    
    return stats


def get_tire_degradation(laps: pd.DataFrame) -> pd.DataFrame:
    """
    Compute tire degradation curves (lap time vs. tire life).
    Useful for predicting pace penalties and pit window timing.
    
    Args:
        laps: Cleaned laps DataFrame
        
    Returns:
        DataFrame with degradation data by driver and compound
    """
    degradation_data = []
    
    for driver in laps["Driver"].unique():
        driver_laps = laps[laps["Driver"] == driver]
        
        for compound in driver_laps["Compound"].unique():
            compound_laps = driver_laps[driver_laps["Compound"] == compound].sort_values("TyreLife")
            
            if len(compound_laps) < 2:
                continue
            
            # Convert lap time to seconds and tire life to int
            lap_times = compound_laps["LapTime"].dt.total_seconds().values
            tire_life = compound_laps["TyreLife"].astype(int).values
            
            # Skip if all NaN
            if pd.isna(lap_times).all() or pd.isna(tire_life).all():
                continue
            
            # Compute simple linear degradation rate (sec/lap)
            if len(tire_life) > 1:
                degradation_rate = (lap_times[-1] - lap_times[0]) / (tire_life[-1] - tire_life[0]) if tire_life[-1] > tire_life[0] else 0
            else:
                degradation_rate = 0
            
            degradation_data.append({
                "Driver": driver,
                "Compound": compound,
                "LapCount": len(compound_laps),
                "AvgLapTime": lap_times.mean(),
                "FreshLapTime": lap_times[0],
                "WornLapTime": lap_times[-1],
                "DegradationRate": degradation_rate,  # sec/lap
                "MaxTireLife": int(tire_life.max()),
            })
    
    deg_df = pd.DataFrame(degradation_data)
    
    logger.info(f"✓ Degradation curves: {len(deg_df)} stint/compound combinations")
    
    return deg_df


def validate_data_integrity(laps: pd.DataFrame) -> Dict[str, bool]:
    """
    Run data quality checks.
    
    Args:
        laps: Cleaned laps DataFrame
        
    Returns:
        Dictionary of validation results
    """
    checks = {
        "has_drivers": len(laps["Driver"].unique()) > 0,
        "has_lap_times": laps["LapTime"].notna().sum() > 0,
        "has_tire_data": laps["Compound"].notna().sum() > 0,
        "has_positions": laps["Position"].notna().sum() > 0,
        "lap_numbers_sequential": laps.groupby("Driver")["LapNumber"].apply(lambda x: x.is_monotonic_increasing).all(),
    }
    
    all_pass = all(checks.values())
    
    status = "✓" if all_pass else "✗"
    logger.info(f"{status} Data integrity checks: {checks}")
    
    return checks


if __name__ == "__main__":
    # Example: Test cleaner with sample data
    logging.basicConfig(level=logging.INFO)
    
    from data.loader import load_race
    from config import PRIMARY_RACE
    
    session, raw_laps, stats = load_race(**PRIMARY_RACE)
    
    print("\n=== Raw Data ===")
    print(f"Total laps: {len(raw_laps)}")
    print(f"Columns: {raw_laps.columns.tolist()}")
    
    print("\n=== Cleaning ===")
    clean = clean_laps(raw_laps)
    
    print("\n=== Driver Stats ===")
    driver_stats = get_driver_stats(clean)
    print(driver_stats)
    
    print("\n=== Tire Degradation ===")
    degradation = get_tire_degradation(clean)
    print(degradation.head(10))
    
    print("\n=== Data Integrity ===")
    validate_data_integrity(clean)

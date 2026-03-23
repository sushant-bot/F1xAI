"""
FastF1 data loader for F1 race sessions.
Handles session loading, caching, and basic data aggregation.
"""

import logging
from pathlib import Path
from typing import Dict, Tuple, Optional

import pandas as pd
import fastf1
from fastf1.core import Session

from config import CACHE_DIR, FASTF1_CACHE_ENABLED, PRIMARY_RACE, DEBUG_MODE

logger = logging.getLogger(__name__)

# Configure FastF1 caching
if FASTF1_CACHE_ENABLED:
    fastf1.Cache.enable_cache(str(CACHE_DIR))


def load_race(
    year: int,
    event: str,
    session_type: str = "Race"
) -> Tuple[Session, pd.DataFrame, Dict]:
    """
    Load F1 race session data from FastF1.
    
    Args:
        year: Race year (e.g., 2023)
        event: Event name (e.g., "Bahrain Grand Prix")
        session_type: Session type, typically "Race"
        
    Returns:
        session: FastF1 Session object
        laps: DataFrame of all laps (includes pit laps for strategy analysis)
        stats: Dictionary of basic race statistics
    """
    logger.info(f"Loading {year} {event} {session_type}...")
    
    try:
        # Load session
        session = fastf1.get_session(year, event, session_type)
        
        # Load all data
        session.load(
            laps=True,           # Lap timing + session status
            telemetry=False,     # Not needed for current dashboard and model features
            weather=False,       # Not used in current feature set
            messages=True,       # Needed to properly populate deletion-related lap flags
        )
        
        logger.info(f"✓ Session loaded: {len(session.laps)} total laps")
        
        # Compute basic stats
        drivers_list = session.drivers if isinstance(session.drivers, list) else session.drivers.tolist()
        stats = {
            "year": year,
            "event": event,
            "session_type": session_type,
            "total_laps": len(session.laps),
            "num_drivers": len(session.drivers),
            "drivers": drivers_list,
            "num_pit_stops": len(session.laps.pick_box_laps(which="in")),
        }
        
        logger.info(f"✓ Stats: {stats['num_drivers']} drivers, {stats['num_pit_stops']} pit stops")
        
        return session, session.laps, stats
        
    except Exception as e:
        logger.error(f"Failed to load session: {e}")
        raise


def get_driver_laps(
    session: Session,
    driver: str,
    exclude_pit_laps: bool = False
) -> pd.DataFrame:
    """
    Get laps for a specific driver.
    
    Args:
        session: FastF1 Session object
        driver: Driver name or identifier
        exclude_pit_laps: Whether to exclude in/out laps
        
    Returns:
        DataFrame of driver's laps
    """
    laps = session.laps.pick_drivers(driver)
    
    if exclude_pit_laps:
        laps = laps.pick_wo_box()
    
    return laps.reset_index(drop=True)


def get_pit_strategies(session: Session) -> pd.DataFrame:
    """
    Extract pit strategies (stints, tire compounds, lap counts).
    
    Args:
        session: FastF1 Session object
        
    Returns:
        DataFrame with pit strategy by driver and stint
    """
    laps = session.laps
    
    # Group by driver and stint
    strategy_data = []
    
    for driver in session.drivers:
        driver_laps = laps.pick_drivers(driver)
        
        for stint in driver_laps["Stint"].unique():
            stint_laps = driver_laps[driver_laps["Stint"] == stint]
            
            if len(stint_laps) == 0:
                continue
            
            # Get first lap (has compound/fresh tire info)
            first_lap = stint_laps.iloc[0]
            
            strategy_data.append({
                "Driver": driver,
                "Stint": int(stint),
                "Compound": first_lap["Compound"],
                "FreshTyre": first_lap["FreshTyre"],
                "LapStart": int(stint_laps["LapNumber"].min()),
                "LapEnd": int(stint_laps["LapNumber"].max()),
                "LapCount": len(stint_laps),
                "AvgLapTime": stint_laps["LapTime"].mean().total_seconds(),
                "BestLapTime": stint_laps["LapTime"].min().total_seconds(),
            })
    
    strategy_df = pd.DataFrame(strategy_data)
    
    logger.info(f"✓ Pit strategies: {len(strategy_df)} stints across {len(session.drivers)} drivers")
    
    return strategy_df


def get_race_results(session: Session) -> pd.DataFrame:
    """
    Extract race results (finishing positions, points, gaps).
    
    Args:
        session: FastF1 Session object
        
    Returns:
        DataFrame with race results
    """
    results = session.results[
        ["DriverNumber", "Abbreviation", "DriverId", "TeamName", "Position", "Points", "GridPosition", "Status"]
    ].copy()
    
    results = results.rename(columns={
        "DriverNumber": "DriverNum",
        "Abbreviation": "Driver",
        "TeamName": "Team",
    })
    
    logger.info(f"✓ Race results: {len(results)} drivers")
    
    return results


def save_session_cache(session: Session, output_path: Path) -> None:
    """
    Save session data locally for reproducibility and offline use.
    
    Args:
        session: FastF1 Session object
        output_path: Path to save cache
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save laps and results as CSV
    session.laps.to_csv(output_path / "laps.csv", index=False)
    session.results.to_csv(output_path / "results.csv", index=False)
    
    logger.info(f"✓ Session cache saved to {output_path}")


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)
    
    session, laps, stats = load_race(**PRIMARY_RACE)
    
    print(f"\nSession Stats:")
    for key, val in stats.items():
        print(f"  {key}: {val}")
    
    print(f"\nFirst 5 laps:")
    print(laps[["Driver", "LapNumber", "LapTime", "Compound", "TyreLife"]].head())
    
    pit_strats = get_pit_strategies(session)
    print(f"\nPit Strategies (first 5):")
    print(pit_strats.head())
    
    results = get_race_results(session)
    print(f"\nRace Results:")
    print(results)

"""
Strategy engine for pit window recommendation and energy mode decisions.
"""

import logging
from typing import List, Tuple, Dict, Optional

import pandas as pd
import numpy as np

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.config import STRATEGY_PARAMS

logger = logging.getLogger(__name__)


class StrategyEngine:
    """
    Recommends pit windows and energy strategies based on track conditions,
    tire degradation, and position gaps.
    """
    
    def __init__(self):
        self.tire_deg_threshold = STRATEGY_PARAMS["tire_degradation_threshold"]
        self.tire_gain_threshold = STRATEGY_PARAMS["tire_gain_threshold"]
        self.position_gap_push = STRATEGY_PARAMS["position_gap_push"]
        self.position_gap_conserve = STRATEGY_PARAMS["position_gap_conserve"]
        self.push_phase_start = STRATEGY_PARAMS["push_phase_start"]
        self.push_phase_length = STRATEGY_PARAMS["push_phase_length"]
    
    def recommend_pit_lap(
        self,
        driver_laps: pd.DataFrame,
        driver: str,
    ) -> Dict[str, any]:
        """
        Recommend optimal pit lap for a driver based on tire degradation.
        
        Heuristic:
        - Track when lap time increases due to tire wear
        - Recommend pit when degradation rate exceeds threshold OR
        - When going from worn tire to fresh tire saves >1 sec
        
        Args:
            driver_laps: All laps for a driver (pre-pit and post-pit)
            driver: Driver name (for logging)
            
        Returns:
            Dict with pit recommendation
        """
        
        # Group by stint (tire compound)
        recommendations = []
        
        for stint_num, stint_data in driver_laps.groupby("Stint"):
            stint_data = stint_data.sort_values("TyreLife")
            
            if len(stint_data) < 3:
                continue  # Need enough laps to assess degradation
            
            lap_times = stint_data["LapTime"].dt.total_seconds().values
            tire_life = stint_data["TyreLife"].astype(int).values
            lap_nums = stint_data["LapNumber"].astype(int).values
            compound = stint_data["Compound"].iloc[0]
            
            # Skip if all NaN
            if pd.isna(lap_times).all():
                continue
            
            # Compute degradation rate (sec/lap)
            if len(tire_life) > 1 and tire_life[-1] > tire_life[0]:
                deg_rate = (lap_times[-1] - lap_times[0]) / (tire_life[-1] - tire_life[0])
            else:
                deg_rate = 0
            
            # Find lap where degradation becomes problematic (>0.5 sec worst lap vs best)
            time_spread = lap_times.max() - lap_times.min()
            
            # Recommend pit if degradation is significant and we're mid-stint
            if time_spread > self.tire_deg_threshold and len(lap_times) > 5:
                # Recommend pit at ~70% through the stint
                pit_idx = int(len(lap_nums) * 0.7)
                pit_lap = lap_nums[pit_idx] if pit_idx < len(lap_nums) else lap_nums[-1]
                
                recommendations.append({
                    "Stint": stint_num,
                    "Compound": compound,
                    "LapCount": len(lap_nums),
                    "DegradationRate": deg_rate,
                    "TimeSpread": time_spread,
                    "RecommendedPitLap": pit_lap,
                    "Reason": f"Degradation {time_spread:.2f} sec over {len(lap_nums)} laps",
                })
        
        if not recommendations:
            # If no degradation detected, recommend default pit at lap 26 (typical 2-stop race)
            recommendations = [{
                "Stint": 1,
                "Compound": "Unknown",
                "LapCount": 0,
                "DegradationRate": 0,
                "TimeSpread": 0,
                "RecommendedPitLap": 26,
                "Reason": "Default pit window (no significant degradation detected)",
            }]
        
        result = {
            "Driver": driver,
            "PitRecommendations": recommendations,
        }
        
        logger.info(f"Pit recommendations for {driver}: {[r['RecommendedPitLap'] for r in recommendations]}")
        
        return result
    
    def recommend_energy_strategy(
        self,
        current_position: int,
        grid_position: int,
        race_length: int = 57,
    ) -> List[Tuple[int, int, str]]:
        """
        Recommend energy strategy based on current position and grid position.
        
        Heuristics:
        - If within 2 places of leader: push early to defend position
        - If >5 places behind: conserve early, then push late to recover
        - Otherwise: neutral early, push late
        
        Args:
            current_position: Current finishing position (1-20+)
            grid_position: Starting grid position (1-20+)
            race_length: Total race length in laps
            
        Returns:
            List of (lap_start, lap_end, mode) tuples
        """
        
        strategy = []
        
        # Determine strategy based on position gaps
        if current_position <= self.position_gap_push:
            # Leading or near leader: defend position
            logger.info(f"Position {current_position}: Defensive strategy (push early)")
            strategy = [
                (1, 25, "boost"),           # Push early to establish lead
                (26, race_length, "neutral"),  # Neutral to save energy
            ]
        elif current_position >= self.position_gap_conserve:
            # Far behind: recover late
            logger.info(f"Position {current_position}: Recovery strategy (push late)")
            strategy = [
                (1, 30, "conserve"),           # Conserve early to build energy
                (31, race_length, "boost"),    # Push hard to recover positions
            ]
        else:
            # Mid-field: standard race pace
            logger.info(f"Position {current_position}: Standard strategy (push late)")
            strategy = [
                (1, self.push_phase_start - 1, "neutral"),          # Early/mid race: neutral
                (self.push_phase_start, race_length, "boost"),     # Final push
            ]
        
        return strategy
    
    def get_pit_strategy_string(self, pit_recs: Dict) -> str:
        """
        Format pit recommendations as readable string.
        
        Args:
            pit_recs: Pit recommendation dict from recommend_pit_lap
            
        Returns:
            Formatted string
        """
        driver = pit_recs["Driver"]
        recs = pit_recs["PitRecommendations"]
        
        lines = [f"Pit Strategy for {driver}:"]
        
        for i, rec in enumerate(recs, 1):
            lines.append(f"\n  Stint {i} ({rec['Compound']}):")
            lines.append(f"    - Laps: {rec['LapCount']}")
            lines.append(f"    - Pit lap: {rec['RecommendedPitLap']}")
            lines.append(f"    - Reason: {rec['Reason']}")
        
        return "\n".join(lines)
    
    def get_energy_strategy_string(self, strategy: List[Tuple[int, int, str]]) -> str:
        """
        Format energy strategy as readable string.
        
        Args:
            strategy: Strategy list from recommend_energy_strategy
            
        Returns:
            Formatted string
        """
        lines = ["Energy Strategy:"]
        
        for lap_start, lap_end, mode in strategy:
            lines.append(f"  - Laps {lap_start:2d}-{lap_end:2d}: {mode.upper():8s} mode")
        
        return "\n".join(lines)


def create_compound_pit_schedule(
    tire_degradation_data: pd.DataFrame,
    target_compounds: List[str] = ["SOFT", "MEDIUM", "HARD"],
) -> Dict[str, any]:
    """
    Create a pit schedule based on available tire compounds and degradation.
    
    Args:
        tire_degradation_data: DataFrame from cleaner.get_tire_degradation()
        target_compounds: List of compounds to use in pit schedule
        
    Returns:
        Dict with pit schedule
    """
    
    schedule = {
        "compounds": target_compounds,
        "stints": [],
    }
    
    # TODO: Implement compound selection logic
    # For now, return default 3-stop schedule
    schedule["stints"] = [
        {"stint": 1, "compound": "SOFT", "estimated_laps": 18},
        {"stint": 2, "compound": "MEDIUM", "estimated_laps": 20},
        {"stint": 3, "compound": "HARD", "estimated_laps": 19},
    ]
    
    return schedule


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)
    
    from data.loader import load_race
    from data.cleaner import clean_laps
    from ml.features import engineer_features
    from config import PRIMARY_RACE
    
    print("Loading race data...")
    session, raw_laps, stats = load_race(**PRIMARY_RACE)
    clean = clean_laps(raw_laps)
    
    print("Engineering features...")
    feat_df, feat_cols = engineer_features(clean)
    
    # Create strategy engine
    engine = StrategyEngine()
    
    # Test pit recommendation for VER
    print("\n" + "=" * 60)
    print("PIT STRATEGY TEST")
    print("=" * 60)
    
    driver = "VER"
    driver_laps = clean[clean["Driver"] == driver]
    pit_recs = engine.recommend_pit_lap(driver_laps, driver)
    print(engine.get_pit_strategy_string(pit_recs))
    
    # Test energy strategy
    print("\n" + "=" * 60)
    print("ENERGY STRATEGY TEST")
    print("=" * 60)
    
    for pos in [1, 3, 10, 18]:
        strategy = engine.recommend_energy_strategy(pos, grid_position=10, race_length=57)
        print(f"\nPosition {pos}:")
        print(engine.get_energy_strategy_string(strategy))

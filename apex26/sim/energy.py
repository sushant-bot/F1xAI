"""
Energy model for F1 simulation.
Models energy harvest (from braking/coasting), boost modes, and energy state tracking.
"""

import logging
from typing import List, Tuple, Dict

import pandas as pd
import numpy as np

from config import ENERGY_MODEL

logger = logging.getLogger(__name__)


class EnergySimulator:
    """
    Simulates energy state and lap time adjustments based on energy mode.
    
    Energy model:
    - Neutral: 0 energy change/lap, 0 sec penalty
    - Boost: -3 energy/lap, -0.3 sec (faster)
    - Conserve: +1 energy/lap, +0.1 sec penalty (slower, but save energy)
    - Recovery phase: Can be enabled after use_boost to recover energy
    """
    
    def __init__(self):
        self.initial_energy = ENERGY_MODEL["initial_energy"]
        self.neutral_change = ENERGY_MODEL["harvest_neutral"]
        self.conserve_change = ENERGY_MODEL["harvest_conserve"]
        self.conserve_time_penalty = ENERGY_MODEL["time_conserve"]
        self.boost_cost = ENERGY_MODEL["cost_boost"]
        self.boost_time_gain = ENERGY_MODEL["time_boost"]  # Negative = faster
    
    def get_energy_adjustment(self, mode: str) -> Tuple[float, float]:
        """
        Get energy and time adjustments for a given mode.
        
        Args:
            mode: "neutral", "boost", or "conserve"
            
        Returns:
            Tuple of (energy_change, time_change_sec)
        """
        if mode == "boost":
            return self.boost_cost, self.boost_time_gain
        elif mode == "conserve":
            return self.conserve_change, self.conserve_time_penalty
        else:  # neutral
            return self.neutral_change, 0.0
    
    def simulate_race(
        self,
        base_laps: pd.DataFrame,
        strategy: List[Tuple[int, int, str]],  # [(lap_start, lap_end, mode), ...]
    ) -> pd.DataFrame:
        """
        Simulate race with energy mode strategy.
        
        Args:
            base_laps: DataFrame with original lap times
            strategy: List of (lap_start, lap_end, mode) tuples
                      Example: [(1, 20, 'neutral'), (21, 40, 'conserve'), (41, 57, 'boost')]
        
        Returns:
            DataFrame with simulated lap times and energy state
        """
        result = base_laps.copy()
        result["EnergyMode"] = "neutral"
        result["EnergyChange"] = 0.0
        result["TimeAdjustment"] = 0.0
        result["SimulatedLapTime"] = result["LapTime_sec"].copy()
        result["EnergyState"] = float(self.initial_energy)
        
        # Apply strategy
        for lap_start, lap_end, mode in strategy:
            mask = (result["LapNumber"] >= lap_start) & (result["LapNumber"] <= lap_end)
            result.loc[mask, "EnergyMode"] = mode
        
        # Simulate lap by lap
        current_energy = self.initial_energy
        
        for idx in result.index:
            mode = result.loc[idx, "EnergyMode"]
            energy_change, time_change = self.get_energy_adjustment(mode)
            
            # Check if we have enough energy for boost
            if mode == "boost" and current_energy + energy_change < 0:
                # Can't boost, switch to neutral
                mode = "neutral"
                energy_change, time_change = self.get_energy_adjustment(mode)
                result.loc[idx, "EnergyMode"] = mode
            
            # Update energy state
            current_energy += energy_change
            current_energy = max(0, min(current_energy, self.initial_energy * 2))  # Clamp energy
            
            # Update lap time
            simulated_time = result.loc[idx, "LapTime_sec"] + time_change
            
            # Record adjustments
            result.loc[idx, "EnergyChange"] = energy_change
            result.loc[idx, "TimeAdjustment"] = time_change
            result.loc[idx, "SimulatedLapTime"] = simulated_time
            result.loc[idx, "EnergyState"] = current_energy
        
        logger.info(f"✓ Simulated race: {len(result)} laps")
        
        return result
    
    def get_strategy_summary(self, simulated_df: pd.DataFrame) -> str:
        """
        Generate text summary of energy strategy impact.
        
        Args:
            simulated_df: Simulated race DataFrame
            
        Returns:
            Summary text
        """
        total_time_adj = simulated_df["TimeAdjustment"].sum()
        boost_laps = len(simulated_df[simulated_df["EnergyMode"] == "boost"])
        conserve_laps = len(simulated_df[simulated_df["EnergyMode"] == "conserve"])
        
        summary = f"""
        Energy Strategy Summary:
        - Boost laps: {boost_laps} (faster by {self.boost_time_gain:.2f} sec each)
        - Conserve laps: {conserve_laps} (penalty {self.conserve_time_penalty:.2f} sec each)
        - Total time adjustment: {total_time_adj:+.2f} sec
        - Final energy state: {simulated_df["EnergyState"].iloc[-1]:.1f} / {self.initial_energy:.1f}
        """
        
        return summary


def create_default_strategy(race_length: int = 57) -> List[Tuple[int, int, str]]:
    """
    Create default energy strategy (example).
    
    Args:
        race_length: Total number of laps in race
        
    Returns:
        List of (lap_start, lap_end, mode) tuples
    """
    push_phase_start = 40  # Start pushing from lap 40
    push_phase_length = race_length - push_phase_start
    
    strategy = [
        (1, push_phase_start - 1, "neutral"),  # Early race: neutral pace
        (push_phase_start, race_length, "boost"),  # Final push: boost
    ]
    
    return strategy


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
    
    # Prepare sample data for a single driver
    driver = "VER"  # Max Verstappen
    driver_laps = feat_df[feat_df["Driver"] == driver].copy()
    driver_laps["LapTime_sec"] = driver_laps["LapTime"].dt.total_seconds()
    
    print(f"\nSimulating race for {driver} ({len(driver_laps)} laps)...")
    
    # Create simulator
    sim = EnergySimulator()
    
    # Create strategy
    strategy = create_default_strategy(len(driver_laps))
    print(f"Strategy: {strategy}")
    
    # Simulate
    simulated = sim.simulate_race(driver_laps, strategy)
    
    print("\nSimulation Results (first 10 laps):")
    print(simulated[["LapNumber", "LapTime_sec", "EnergyMode", "TimeAdjustment", "SimulatedLapTime", "EnergyState"]].head(10).to_string())
    
    print("\nLast 10 laps:")
    print(simulated[["LapNumber", "LapTime_sec", "EnergyMode", "TimeAdjustment", "SimulatedLapTime", "EnergyState"]].tail(10).to_string())
    
    print(sim.get_strategy_summary(simulated))

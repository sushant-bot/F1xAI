"""
Simulation service for what-if scenarios.
"""

import logging
from typing import Dict, List, Tuple

import pandas as pd
import numpy as np

from app.models.race import (
    SimulationResponse,
    SimulationResult,
    SimulationLap,
    SimulationRequest,
    EnergyPhase,
)
from app.core.sim.energy import EnergySimulator, create_default_strategy
from app.core.ml.features import engineer_features

logger = logging.getLogger(__name__)


class SimulationService:
    """Service for race simulation."""

    def __init__(self):
        self.energy_simulator = EnergySimulator()

    def simulate_race(
        self,
        session_id: str,
        clean_laps: pd.DataFrame,
        race_results: pd.DataFrame,
        requests: List[SimulationRequest] = None,
    ) -> SimulationResponse:
        """
        Run race simulation with custom energy strategies.

        Args:
            session_id: Session identifier
            clean_laps: Cleaned laps DataFrame
            race_results: Race results DataFrame
            requests: List of simulation requests (driver + strategy)
                     If None, simulates all drivers with default strategy

        Returns:
            SimulationResponse with results for all requested drivers
        """
        results = []

        # Prepare feature data
        feat_df, feat_cols = engineer_features(clean_laps, race_results)

        # If no requests, simulate all drivers with default strategy
        if requests is None:
            drivers = clean_laps["Driver"].unique()
            race_length = int(clean_laps.groupby("Driver")["LapNumber"].max().max())
            default_strategy = self._convert_strategy(
                create_default_strategy(race_length)
            )
            requests = [
                SimulationRequest(driver_code=d, strategy=default_strategy)
                for d in drivers
            ]

        for req in requests:
            try:
                result = self._simulate_driver(
                    feat_df, req.driver_code, req.strategy
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to simulate {req.driver_code}: {e}")
                continue

        # Generate summary
        summary = self._generate_summary(results)

        return SimulationResponse(
            session_id=session_id,
            results=results,
            summary=summary,
        )

    def simulate_driver(
        self,
        session_id: str,
        driver_code: str,
        strategy: List[EnergyPhase],
        clean_laps: pd.DataFrame,
        race_results: pd.DataFrame,
    ) -> SimulationResult:
        """
        Simulate race for a single driver with custom strategy.

        Args:
            session_id: Session identifier
            driver_code: Driver code (e.g., "VER")
            strategy: Energy strategy phases
            clean_laps: Cleaned laps DataFrame
            race_results: Race results DataFrame

        Returns:
            SimulationResult for the driver
        """
        # Prepare feature data
        feat_df, feat_cols = engineer_features(clean_laps, race_results)

        return self._simulate_driver(feat_df, driver_code, strategy)

    def _simulate_driver(
        self,
        feat_df: pd.DataFrame,
        driver_code: str,
        strategy: List[EnergyPhase],
    ) -> SimulationResult:
        """Run simulation for a single driver."""
        driver_laps = feat_df[feat_df["Driver"] == driver_code].copy()
        if driver_laps.empty:
            raise ValueError(f"Driver {driver_code} not found.")

        # Ensure LapTime_sec exists
        if "LapTime_sec" not in driver_laps.columns:
            driver_laps["LapTime_sec"] = driver_laps["LapTime"].dt.total_seconds()

        # Convert strategy to tuple format
        strategy_tuples = [
            (phase.lap_start, phase.lap_end, phase.mode)
            for phase in strategy
        ]

        # Run simulation
        simulated = self.energy_simulator.simulate_race(driver_laps, strategy_tuples)

        # Extract results
        laps = []
        for _, row in simulated.iterrows():
            try:
                laps.append(SimulationLap(
                    lap_number=int(row["LapNumber"]),
                    original_time_seconds=round(float(row["LapTime_sec"]), 2),
                    simulated_time_seconds=round(float(row["SimulatedLapTime"]), 2),
                    energy_mode=str(row["EnergyMode"]),
                    energy_change=round(float(row["EnergyChange"]), 1),
                    time_adjustment=round(float(row["TimeAdjustment"]), 2),
                    energy_state=round(float(row["EnergyState"]), 1),
                ))
            except Exception:
                continue

        # Calculate totals
        total_original = simulated["LapTime_sec"].sum()
        total_simulated = simulated["SimulatedLapTime"].sum()
        time_gained = total_original - total_simulated  # Positive = faster

        boost_laps = len(simulated[simulated["EnergyMode"] == "boost"])
        conserve_laps = len(simulated[simulated["EnergyMode"] == "conserve"])
        final_energy = float(simulated["EnergyState"].iloc[-1]) if len(simulated) > 0 else 50.0

        return SimulationResult(
            driver_code=driver_code,
            driver_name=driver_code,
            laps=laps,
            total_time_original=round(total_original, 2),
            total_time_simulated=round(total_simulated, 2),
            time_gained_seconds=round(time_gained, 2),
            boost_laps=boost_laps,
            conserve_laps=conserve_laps,
            final_energy=round(final_energy, 1),
        )

    def _convert_strategy(
        self,
        strategy_tuples: List[Tuple[int, int, str]],
    ) -> List[EnergyPhase]:
        """Convert tuple strategy to EnergyPhase list."""
        return [
            EnergyPhase(lap_start=s, lap_end=e, mode=m)
            for s, e, m in strategy_tuples
        ]

    def _generate_summary(self, results: List[SimulationResult]) -> str:
        """Generate summary of simulation results."""
        if not results:
            return "No simulation results."

        total_time_gained = sum(r.time_gained_seconds for r in results)
        avg_time_gained = total_time_gained / len(results)

        fastest_gain = max(results, key=lambda r: r.time_gained_seconds)
        slowest_gain = min(results, key=lambda r: r.time_gained_seconds)

        lines = [
            f"Simulated {len(results)} drivers.",
            f"Average time gained: {avg_time_gained:+.2f} sec",
            f"Best improvement: {fastest_gain.driver_code} ({fastest_gain.time_gained_seconds:+.2f} sec)",
            f"Least improvement: {slowest_gain.driver_code} ({slowest_gain.time_gained_seconds:+.2f} sec)",
        ]

        return " | ".join(lines)


def create_custom_strategy(
    phases: List[dict],
) -> List[EnergyPhase]:
    """
    Create custom energy strategy from phase definitions.

    Args:
        phases: List of {"lap_start": int, "lap_end": int, "mode": str}

    Returns:
        List of EnergyPhase
    """
    return [
        EnergyPhase(
            lap_start=p["lap_start"],
            lap_end=p["lap_end"],
            mode=p["mode"],
        )
        for p in phases
    ]

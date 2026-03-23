"""
Strategy service for pit and energy recommendations.
"""

import logging
from typing import Dict, List, Tuple

import pandas as pd
import numpy as np

from app.models.race import (
    StrategyResponse,
    DriverStrategy,
    PitRecommendation,
    EnergyPhase,
)
from app.core.sim.strategy import StrategyEngine

logger = logging.getLogger(__name__)


class StrategyService:
    """Service for strategy recommendations."""

    def __init__(self):
        self.strategy_engine = StrategyEngine()

    def get_race_strategy(
        self,
        session_id: str,
        clean_laps: pd.DataFrame,
        race_results: pd.DataFrame,
        race_length: int = 57,
    ) -> StrategyResponse:
        """
        Generate pit and energy strategy recommendations for all drivers.

        Args:
            session_id: Session identifier
            clean_laps: Cleaned laps DataFrame
            race_results: Race results DataFrame
            race_length: Total race length in laps

        Returns:
            StrategyResponse with recommendations for all drivers
        """
        strategies = []

        for driver in clean_laps["Driver"].unique():
            driver_laps = clean_laps[clean_laps["Driver"] == driver].copy()
            if driver_laps.empty:
                continue

            # Get driver position info
            driver_result = race_results[race_results["Driver"] == driver]
            if driver_result.empty:
                current_position = 10
                grid_position = 10
            else:
                current_position = int(driver_result.iloc[0].get("Position", 10) or 10)
                grid_position = int(driver_result.iloc[0].get("GridPosition", 10) or 10)

            # Get pit recommendations
            pit_recs = self._get_pit_recommendations(driver_laps, driver)

            # Get energy strategy
            energy_strategy = self._get_energy_strategy(
                current_position, grid_position, race_length
            )

            # Generate summary
            summary = self._generate_strategy_summary(
                driver, pit_recs, energy_strategy, current_position
            )

            strategies.append(DriverStrategy(
                driver_code=driver,
                driver_name=driver,
                current_position=current_position,
                grid_position=grid_position,
                pit_recommendations=pit_recs,
                energy_strategy=energy_strategy,
                strategy_summary=summary,
            ))

        return StrategyResponse(
            session_id=session_id,
            race_length=race_length,
            strategies=strategies,
        )

    def get_driver_strategy(
        self,
        session_id: str,
        driver_code: str,
        clean_laps: pd.DataFrame,
        race_results: pd.DataFrame,
        race_length: int = 57,
    ) -> DriverStrategy:
        """
        Generate strategy recommendations for a specific driver.

        Args:
            session_id: Session identifier
            driver_code: Driver code (e.g., "VER")
            clean_laps: Cleaned laps DataFrame
            race_results: Race results DataFrame
            race_length: Total race length in laps

        Returns:
            DriverStrategy with recommendations
        """
        driver_laps = clean_laps[clean_laps["Driver"] == driver_code].copy()
        if driver_laps.empty:
            raise ValueError(f"Driver {driver_code} not found in session.")

        # Get driver position info
        driver_result = race_results[race_results["Driver"] == driver_code]
        if driver_result.empty:
            current_position = 10
            grid_position = 10
        else:
            current_position = int(driver_result.iloc[0].get("Position", 10) or 10)
            grid_position = int(driver_result.iloc[0].get("GridPosition", 10) or 10)

        # Get pit recommendations
        pit_recs = self._get_pit_recommendations(driver_laps, driver_code)

        # Get energy strategy
        energy_strategy = self._get_energy_strategy(
            current_position, grid_position, race_length
        )

        # Generate summary
        summary = self._generate_strategy_summary(
            driver_code, pit_recs, energy_strategy, current_position
        )

        return DriverStrategy(
            driver_code=driver_code,
            driver_name=driver_code,
            current_position=current_position,
            grid_position=grid_position,
            pit_recommendations=pit_recs,
            energy_strategy=energy_strategy,
            strategy_summary=summary,
        )

    def _get_pit_recommendations(
        self,
        driver_laps: pd.DataFrame,
        driver: str,
    ) -> List[PitRecommendation]:
        """Get pit recommendations for a driver."""
        recommendations = []

        pit_rec = self.strategy_engine.recommend_pit_lap(driver_laps, driver)

        for rec in pit_rec["PitRecommendations"]:
            recommendations.append(PitRecommendation(
                stint=int(rec["Stint"]),
                compound=str(rec["Compound"]),
                lap_count=int(rec["LapCount"]),
                degradation_rate=round(float(rec["DegradationRate"]), 3),
                time_spread=round(float(rec["TimeSpread"]), 2),
                recommended_pit_lap=int(rec["RecommendedPitLap"]),
                reason=str(rec["Reason"]),
            ))

        return recommendations

    def _get_energy_strategy(
        self,
        current_position: int,
        grid_position: int,
        race_length: int,
    ) -> List[EnergyPhase]:
        """Get energy strategy for a driver."""
        strategy_tuples = self.strategy_engine.recommend_energy_strategy(
            current_position, grid_position, race_length
        )

        energy_phases = []
        for lap_start, lap_end, mode in strategy_tuples:
            energy_phases.append(EnergyPhase(
                lap_start=lap_start,
                lap_end=lap_end,
                mode=mode,
            ))

        return energy_phases

    def _generate_strategy_summary(
        self,
        driver: str,
        pit_recs: List[PitRecommendation],
        energy_strategy: List[EnergyPhase],
        position: int,
    ) -> str:
        """Generate text summary of strategy."""
        pit_laps = [rec.recommended_pit_lap for rec in pit_recs]
        pit_str = ", ".join(map(str, pit_laps)) if pit_laps else "None"

        energy_phases = []
        for phase in energy_strategy:
            energy_phases.append(f"L{phase.lap_start}-{phase.lap_end}: {phase.mode.upper()}")
        energy_str = " | ".join(energy_phases)

        position_context = "defending" if position <= 3 else "attacking" if position >= 10 else "mid-pack"

        return (
            f"Strategy for {driver} (P{position}, {position_context}): "
            f"Pit on laps [{pit_str}]. Energy: {energy_str}"
        )

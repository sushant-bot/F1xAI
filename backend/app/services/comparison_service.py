"""
Multi-season track comparison and trend prediction service.
"""

import logging
from typing import List, Dict
from collections import defaultdict
import numpy as np

from app.models.race import (
    SeasonMetrics,
    StrategyTrend,
    PaceTrend,
    DegradationTrend,
    TrackComparisonResponse,
    PredictedStrategy,
    TrendPredictionResponse,
    DriverSeasonPerformance,
    DriverComparison,
    DriverPredictionResult,
    TrendPredictionWithDriversResponse,
)
from app.services.race_service import RaceService

logger = logging.getLogger(__name__)


class ComparisonService:
    """Service for multi-season comparison and trend prediction."""

    def __init__(self, race_service: RaceService):
        self.race_service = race_service

    def compare_track_seasons(
        self, track_name: str, years: List[int], event_name: str
    ) -> TrackComparisonResponse:
        """Compare the same track across multiple seasons."""
        season_metrics: List[SeasonMetrics] = []
        driver_seasons: Dict[str, List[DriverSeasonPerformance]] = defaultdict(list)

        pit_laps_all = []
        lap_times_all = []
        degradation_all = []
        strategies_all = []

        for year in sorted(set(years)):
            try:
                # Load race data
                load_response = self.race_service.load_race(year, event_name, "Race")
                overview = self.race_service.get_race_overview(load_response.session_id)
                session_payload = self.race_service._sessions.get(load_response.session_id, {})
                driver_team_map = self._build_driver_team_map(session_payload.get("race_results"))

                # Extract metrics
                avg_lap = overview.metrics.avg_lap_time_seconds
                best_lap = min(
                    (bl.best_lap_time_seconds for bl in overview.best_laps),
                    default=avg_lap
                )

                # Winner
                winner = next(
                    (r for r in overview.race_results if r.position == 1),
                    None
                )
                winner_code = winner.driver_code if winner else "UNK"
                winner_name = winner.driver_name if winner else "Unknown"

                # Pit stops
                pit_stops = overview.pit_strategies
                total_pits = len(pit_stops)
                pit_laps = [p.lap_number for p in pit_stops if p.lap_number > 0]
                avg_pit_lap = float(np.mean(pit_laps)) if pit_laps else 0.0
                pit_laps_all.extend(pit_laps)

                # Strategy analysis
                compounds = [p.compound for p in pit_stops]
                compound_counts = {}
                for c in compounds:
                    compound_counts[c] = compound_counts.get(c, 0) + 1
                sorted_compounds = sorted(
                    compound_counts.items(), key=lambda x: x[1], reverse=True
                )
                dominant_strategy = " → ".join(
                    [c[0] for c in sorted_compounds[:2]]
                ) if sorted_compounds else "Unknown"
                strategies_all.append(dominant_strategy)

                # Degradation (simplified - based on lap time variance)
                lap_times = [lt.lap_time_seconds for lt in overview.lap_times if lt.lap_time_seconds > 0]
                if len(lap_times) > 10:
                    # Estimate degradation from lap time increase
                    first_half = lap_times[:len(lap_times)//2]
                    second_half = lap_times[len(lap_times)//2:]
                    deg_rate = (np.mean(second_half) - np.mean(first_half)) / (len(lap_times) / 2)
                else:
                    deg_rate = 0.0
                degradation_all.append(deg_rate)

                lap_times_all.append(avg_lap)

                season_metrics.append(SeasonMetrics(
                    year=year,
                    avg_lap_time_seconds=round(avg_lap, 2),
                    best_lap_time_seconds=round(best_lap, 2),
                    winner_code=winner_code,
                    winner_name=winner_name,
                    total_pit_stops=total_pits,
                    avg_pit_lap=round(avg_pit_lap, 1),
                    dominant_strategy=dominant_strategy,
                    avg_degradation_rate=round(abs(deg_rate), 4),
                    safety_cars=0,  # Not easily available from basic data
                ))

                # Extract per-driver performance
                self._extract_driver_performances(
                    year, overview, driver_seasons, pit_stops, driver_team_map
                )

            except Exception as e:
                logger.warning(f"Failed to load {year} {event_name}: {e}")
                continue

        if len(season_metrics) < 2:
            raise ValueError(f"Need data from at least 2 seasons for {event_name}")

        # Build driver comparisons
        driver_comparisons = self._build_driver_comparisons(driver_seasons)
        loaded_years = [metric.year for metric in season_metrics]

        # Compute trends
        strategy_trend = self._compute_strategy_trend(pit_laps_all, strategies_all)
        pace_trend = self._compute_pace_trend(loaded_years, lap_times_all)
        degradation_trend = self._compute_degradation_trend(loaded_years, degradation_all)

        # Generate insights
        insights = self._generate_insights(
            season_metrics, strategy_trend, pace_trend, degradation_trend
        )

        return TrackComparisonResponse(
            track_name=track_name,
            years=loaded_years,
            season_metrics=season_metrics,
            driver_comparisons=driver_comparisons,
            strategy_trend=strategy_trend,
            pace_trend=pace_trend,
            degradation_trend=degradation_trend,
            insights=insights,
        )

    def _extract_driver_performances(
        self,
        year: int,
        overview,
        driver_seasons: Dict[str, List[DriverSeasonPerformance]],
        pit_stops: list,
        driver_team_map: Dict[str, str],
    ):
        """Extract individual driver performance for a season."""
        # Count pit stops per driver
        driver_pits = defaultdict(int)
        for ps in pit_stops:
            driver_pits[ps.driver_code] += 1

        # Get lap times per driver
        driver_lap_times: Dict[str, List[float]] = defaultdict(list)
        for lt in overview.lap_times:
            if lt.lap_time_seconds > 0:
                driver_lap_times[lt.driver_code].append(lt.lap_time_seconds)

        # Get best lap per driver
        driver_best_laps = {bl.driver_code: bl.best_lap_time_seconds for bl in overview.best_laps}

        for result in overview.race_results:
            lap_times = driver_lap_times.get(result.driver_code, [])
            avg_lap = float(np.mean(lap_times)) if lap_times else 0.0
            best_lap = driver_best_laps.get(result.driver_code, avg_lap)

            # Calculate consistency score (lower variance = higher score)
            if len(lap_times) > 5:
                variance = float(np.std(lap_times))
                # Scale: 0.5s std = 100, 2s std = 50, 4s+ std = 0
                consistency = max(0, min(100, 100 - (variance - 0.5) * 25))
            else:
                consistency = 50.0

            # Prefer exact team names from the loaded results, then fall back.
            team = driver_team_map.get(
                result.driver_code,
                self._get_driver_team(result.driver_code),
            )

            perf = DriverSeasonPerformance(
                year=year,
                driver_code=result.driver_code,
                driver_name=result.driver_name,
                team=team,
                grid_position=result.grid_position,
                finish_position=result.position,
                points=result.points,
                avg_lap_time_seconds=round(avg_lap, 3),
                best_lap_time_seconds=round(best_lap, 3),
                consistency_score=round(consistency, 1),
                pit_stops=driver_pits.get(result.driver_code, 0),
                laps_completed=result.laps_completed,
                status=result.status,
            )
            driver_seasons[result.driver_code].append(perf)

    def _build_driver_team_map(self, results_df) -> Dict[str, str]:
        """Build a driver-to-team map from the raw FastF1 results dataframe."""
        if results_df is None or getattr(results_df, "empty", True):
            return {}

        team_map: Dict[str, str] = {}
        for _, row in results_df.iterrows():
            driver_code = str(row.get("Driver", "")).strip().upper()
            team = str(row.get("Team", "")).strip()
            if driver_code and team and team.lower() != "nan":
                team_map[driver_code] = team

        return team_map

    def _get_driver_team(self, driver_code: str) -> str:
        """Get team for driver code."""
        team_map = {
            "VER": "Red Bull Racing", "PER": "Red Bull Racing",
            "HAM": "Mercedes", "RUS": "Mercedes",
            "LEC": "Ferrari", "SAI": "Ferrari",
            "NOR": "McLaren", "PIA": "McLaren",
            "ALO": "Aston Martin", "STR": "Aston Martin",
            "GAS": "Alpine", "OCO": "Alpine",
            "TSU": "RB", "RIC": "RB", "DEV": "AlphaTauri", "LAW": "RB",
            "BOT": "Alfa Romeo", "ZHO": "Alfa Romeo",
            "MAG": "Haas", "HUL": "Haas",
            "ALB": "Williams", "SAR": "Williams",
            "VET": "Aston Martin", "LAT": "Williams",
            "MSC": "Haas", "MAZ": "Haas",
            "RAI": "Alfa Romeo", "GIO": "Alfa Romeo",
            "KUB": "Alfa Romeo", "AIT": "Williams",
        }
        return team_map.get(driver_code, "Unknown")

    def _build_driver_comparisons(
        self, driver_seasons: Dict[str, List[DriverSeasonPerformance]]
    ) -> List[DriverComparison]:
        """Build driver comparison objects from season data."""
        comparisons = []

        for driver_code, seasons in driver_seasons.items():
            if not seasons:
                continue

            # Calculate aggregates
            positions = [s.finish_position for s in seasons]
            avg_position = float(np.mean(positions))
            best_finish = min(positions)
            worst_finish = max(positions)
            podiums = sum(1 for p in positions if p <= 3)
            wins = sum(1 for p in positions if p == 1)

            # Calculate lap time trend
            if len(seasons) >= 2:
                valid_lap_seasons = [
                    (season.year, season.avg_lap_time_seconds)
                    for season in seasons
                    if season.avg_lap_time_seconds > 0
                ]
                if len(valid_lap_seasons) >= 2:
                    years, lap_times = zip(*valid_lap_seasons)
                    slope, _ = np.polyfit(years, lap_times, 1)
                    lap_time_trend = float(slope)
                else:
                    lap_time_trend = 0.0
            else:
                lap_time_trend = 0.0

            # Calculate consistency trend
            consistencies = [s.consistency_score for s in seasons]
            if len(consistencies) >= 2:
                first_half = np.mean(consistencies[:len(consistencies)//2])
                second_half = np.mean(consistencies[len(consistencies)//2:])
                if second_half > first_half + 5:
                    consistency_trend = "improving"
                elif second_half < first_half - 5:
                    consistency_trend = "declining"
                else:
                    consistency_trend = "stable"
            else:
                consistency_trend = "stable"

            comparisons.append(DriverComparison(
                driver_code=driver_code,
                driver_name=seasons[0].driver_name,
                seasons=sorted(seasons, key=lambda s: s.year),
                avg_finish_position=round(avg_position, 1),
                best_finish=best_finish,
                worst_finish=worst_finish,
                podiums=podiums,
                wins=wins,
                avg_lap_time_trend=round(lap_time_trend, 4),
                consistency_trend=consistency_trend,
            ))

        # Sort by average finish position
        comparisons.sort(key=lambda c: c.avg_finish_position)
        return comparisons

    def _compute_strategy_trend(
        self, pit_laps: List[int], strategies: List[str]
    ) -> StrategyTrend:
        """Compute strategy trends across seasons."""
        if not pit_laps:
            return StrategyTrend(
                avg_first_pit_lap=0.0,
                pit_window_start=0,
                pit_window_end=0,
                most_common_compounds=["Unknown"],
                strategy_shift="stable",
            )

        avg_pit = float(np.mean(pit_laps))
        std_pit = float(np.std(pit_laps)) if len(pit_laps) > 1 else 5.0

        # Window is mean +/- 1 std
        window_start = max(1, int(avg_pit - std_pit))
        window_end = int(avg_pit + std_pit)

        # Extract compounds from strategies
        all_compounds = []
        for s in strategies:
            compounds = s.replace("→", " ").split()
            all_compounds.extend(compounds)

        compound_counts = {}
        for c in all_compounds:
            c = c.strip()
            if c and c.upper() in ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]:
                compound_counts[c] = compound_counts.get(c, 0) + 1

        most_common = sorted(
            compound_counts.items(), key=lambda x: x[1], reverse=True
        )[:3]
        common_compounds = [c[0] for c in most_common] if most_common else ["MEDIUM"]

        # Determine shift (simplified)
        if len(pit_laps) > 2:
            first_half_avg = np.mean(pit_laps[:len(pit_laps)//2])
            second_half_avg = np.mean(pit_laps[len(pit_laps)//2:])
            if second_half_avg < first_half_avg - 2:
                shift = "earlier"
            elif second_half_avg > first_half_avg + 2:
                shift = "later"
            else:
                shift = "stable"
        else:
            shift = "stable"

        return StrategyTrend(
            avg_first_pit_lap=round(avg_pit, 1),
            pit_window_start=window_start,
            pit_window_end=window_end,
            most_common_compounds=common_compounds,
            strategy_shift=shift,
        )

    def _compute_pace_trend(
        self, years: List[int], lap_times: List[float]
    ) -> PaceTrend:
        """Compute pace evolution trend."""
        if len(years) < 2 or len(lap_times) < 2:
            return PaceTrend(
                years=years,
                avg_lap_times=lap_times,
                improvement_per_year=0.0,
                trend_direction="stable",
            )

        # Linear regression for trend
        x = np.array(years[:len(lap_times)])
        y = np.array(lap_times)

        if len(x) > 1:
            slope, _ = np.polyfit(x, y, 1)
            improvement_per_year = -slope  # Negative slope = faster
        else:
            improvement_per_year = 0.0

        if improvement_per_year > 0.3:
            direction = "faster"
        elif improvement_per_year < -0.3:
            direction = "slower"
        else:
            direction = "stable"

        return PaceTrend(
            years=list(x),
            avg_lap_times=[round(t, 2) for t in y],
            improvement_per_year=round(improvement_per_year, 3),
            trend_direction=direction,
        )

    def _compute_degradation_trend(
        self, years: List[int], deg_rates: List[float]
    ) -> DegradationTrend:
        """Compute tire degradation trend."""
        if len(years) < 2 or len(deg_rates) < 2:
            return DegradationTrend(
                years=years,
                avg_degradation_rates=deg_rates,
                trend="stable",
            )

        x = np.array(years[:len(deg_rates)])
        y = np.array(deg_rates)

        if len(x) > 1:
            slope, _ = np.polyfit(x, y, 1)
        else:
            slope = 0.0

        if slope > 0.001:
            trend = "higher"
        elif slope < -0.001:
            trend = "lower"
        else:
            trend = "stable"

        return DegradationTrend(
            years=list(x),
            avg_degradation_rates=[round(abs(d), 4) for d in y],
            trend=trend,
        )

    def _generate_insights(
        self,
        metrics: List[SeasonMetrics],
        strategy: StrategyTrend,
        pace: PaceTrend,
        degradation: DegradationTrend,
    ) -> List[str]:
        """Generate human-readable insights from trends."""
        insights = []

        # Pace insight
        if pace.trend_direction == "faster":
            insights.append(
                f"Lap times improved by ~{abs(pace.improvement_per_year):.2f}s/year"
            )
        elif pace.trend_direction == "slower":
            insights.append(
                f"Lap times increased by ~{abs(pace.improvement_per_year):.2f}s/year"
            )

        # Strategy insight
        if strategy.strategy_shift == "earlier":
            insights.append(
                f"Pit stops trending earlier (avg lap {strategy.avg_first_pit_lap:.0f})"
            )
        elif strategy.strategy_shift == "later":
            insights.append(
                f"Pit stops trending later (avg lap {strategy.avg_first_pit_lap:.0f})"
            )

        # Degradation insight
        if degradation.trend == "higher":
            insights.append("Tire degradation has increased over seasons")
        elif degradation.trend == "lower":
            insights.append("Tire degradation has decreased over seasons")

        # Winner patterns
        winner_codes = [m.winner_code for m in metrics]
        if len(set(winner_codes)) == 1:
            insights.append(f"{winner_codes[0]} dominated this track")

        # Add pit window
        insights.append(
            f"Optimal pit window: Lap {strategy.pit_window_start}-{strategy.pit_window_end}"
        )

        return insights

    def predict_next_race(
        self, track_name: str, years: List[int], event_name: str, prediction_year: int
    ) -> TrendPredictionWithDriversResponse:
        """Predict strategy and performance for next race based on trends."""
        # First get comparison data
        comparison = self.compare_track_seasons(track_name, years, event_name)

        # Predict lap time using linear extrapolation
        if len(comparison.pace_trend.years) >= 2:
            x = np.array(comparison.pace_trend.years)
            y = np.array(comparison.pace_trend.avg_lap_times)
            slope, intercept = np.polyfit(x, y, 1)
            predicted_lap_time = slope * prediction_year + intercept
        else:
            predicted_lap_time = comparison.season_metrics[-1].avg_lap_time_seconds

        # Predict degradation level
        avg_deg = np.mean(comparison.degradation_trend.avg_degradation_rates)
        if avg_deg > 0.03:
            deg_level = "HIGH"
        elif avg_deg > 0.015:
            deg_level = "MEDIUM"
        else:
            deg_level = "LOW"

        # Predict strategy
        strategy = comparison.strategy_trend
        pit_window = f"Lap {strategy.pit_window_start}-{strategy.pit_window_end}"

        # Use most common compounds for predicted strategy
        if len(strategy.most_common_compounds) >= 2:
            pred_strategy = f"{strategy.most_common_compounds[0]} → {strategy.most_common_compounds[1]}"
        else:
            pred_strategy = "Medium → Hard"

        # Calculate confidence based on data consistency
        confidence = self._calculate_confidence(comparison)

        # Pace prediction
        if comparison.pace_trend.improvement_per_year > 0.2:
            pace_pred = f"Expected ~{comparison.pace_trend.improvement_per_year:.2f}s faster than last year"
        elif comparison.pace_trend.improvement_per_year < -0.2:
            pace_pred = f"Expected ~{abs(comparison.pace_trend.improvement_per_year):.2f}s slower than last year"
        else:
            pace_pred = "Similar pace expected to previous years"

        predicted_strategy = PredictedStrategy(
            predicted_pit_window=pit_window,
            predicted_strategy=pred_strategy,
            confidence=confidence,
            reasoning=f"Based on {len(years)} seasons of data at this circuit",
        )

        # Generate driver predictions
        driver_predictions = self._predict_drivers(
            comparison.driver_comparisons, prediction_year, predicted_lap_time
        )

        return TrendPredictionWithDriversResponse(
            track_name=track_name,
            prediction_year=prediction_year,
            based_on_years=comparison.years,
            predicted_avg_lap_time=round(predicted_lap_time, 2),
            predicted_degradation=deg_level,
            predicted_strategy=predicted_strategy,
            pace_prediction=pace_pred,
            driver_predictions=driver_predictions,
            confidence_overall=confidence,
            methodology="Linear trend extrapolation + historical pattern analysis",
        )

    def _predict_drivers(
        self,
        driver_comparisons: List[DriverComparison],
        prediction_year: int,
        overall_predicted_lap: float
    ) -> List[DriverPredictionResult]:
        """Generate predictions for individual drivers."""
        predictions = []

        for dc in driver_comparisons:
            # Predict finish range based on historical positions and trend
            positions = [s.finish_position for s in dc.seasons]
            avg_pos = dc.avg_finish_position

            # Narrow range for consistent drivers
            if dc.consistency_trend == "improving":
                pos_range = (max(1, int(avg_pos - 1)), int(avg_pos + 1))
            elif dc.consistency_trend == "declining":
                pos_range = (int(avg_pos - 1), int(avg_pos + 3))
            else:
                pos_range = (max(1, int(avg_pos - 2)), int(avg_pos + 2))

            predicted_finish = f"{pos_range[0]}-{pos_range[1]}"

            # Predict lap time based on driver's trend
            if dc.seasons:
                last_lap = dc.seasons[-1].avg_lap_time_seconds
                predicted_lap = last_lap + dc.avg_lap_time_trend
            else:
                predicted_lap = overall_predicted_lap

            # Identify strengths and weaknesses
            strengths = []
            weaknesses = []

            if dc.wins > 0:
                strengths.append(f"{dc.wins} win(s) at this track")
            if dc.podiums > 1:
                strengths.append(f"{dc.podiums} podiums historically")
            if dc.consistency_trend == "improving":
                strengths.append("Improving consistency")
            if dc.best_finish == 1:
                strengths.append("Has won here before")

            if dc.consistency_trend == "declining":
                weaknesses.append("Declining consistency")
            if dc.worst_finish > 10:
                weaknesses.append(f"Has finished as low as P{dc.worst_finish}")
            if dc.avg_lap_time_trend > 0.2:
                weaknesses.append("Pace getting slower")

            # Calculate driver-specific confidence
            num_seasons = len(dc.seasons)
            driver_confidence = min(50 + num_seasons * 15, 90)

            reasoning = f"Based on {num_seasons} season(s): avg P{dc.avg_finish_position:.1f}, "
            reasoning += f"best P{dc.best_finish}, "
            reasoning += f"consistency {dc.consistency_trend}"

            predictions.append(DriverPredictionResult(
                driver_code=dc.driver_code,
                driver_name=dc.driver_name,
                team=dc.seasons[-1].team if dc.seasons else "Unknown",
                predicted_finish_range=predicted_finish,
                predicted_avg_lap_time=round(predicted_lap, 3),
                confidence=driver_confidence,
                strengths=strengths if strengths else ["No specific strengths identified"],
                weaknesses=weaknesses if weaknesses else ["No specific weaknesses identified"],
                reasoning=reasoning,
            ))

        return predictions

    def _calculate_confidence(self, comparison: TrackComparisonResponse) -> float:
        """Calculate prediction confidence based on data quality."""
        confidence = 50.0  # Base confidence

        # More years = higher confidence
        num_years = len(comparison.years)
        confidence += min(num_years * 10, 30)  # Up to +30%

        # Consistent strategy = higher confidence
        if comparison.strategy_trend.strategy_shift == "stable":
            confidence += 10

        # Consistent pace trend = higher confidence
        if comparison.pace_trend.trend_direction != "stable":
            confidence += 5

        return min(confidence, 95.0)  # Cap at 95%


# Singleton instance
_comparison_service: ComparisonService = None


def get_comparison_service(race_service: RaceService) -> ComparisonService:
    """Get or create comparison service singleton."""
    global _comparison_service
    if _comparison_service is None:
        _comparison_service = ComparisonService(race_service)
    return _comparison_service

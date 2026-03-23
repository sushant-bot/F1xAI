import time
import logging
from typing import Dict, Optional, List, Tuple
from datetime import datetime

import pandas as pd
import numpy as np

from app.models.race import (
    RaceOverview,
    RaceOverviewMetrics,
    DriverLapTime,
    RaceResult,
    PitStop,
    TireCompound,
    DriverBestLap,
    RaceLoadResponse,
    # Predictions
    PredictionResponse,
    DriverPrediction,
    LapPrediction,
    ModelMetrics,
    FeatureImportance,
    # Driver Analysis
    DriverAnalysisResponse,
    DriverPaceMetrics,
    StintAnalysis,
)
from app.core.data.loader import (
    load_race as load_race_session,
    get_race_results,
    get_pit_strategies,
)
from app.core.data.cleaner import clean_laps
from app.core.ml.features import engineer_features, prepare_train_test, compute_driver_pace
from app.core.ml.models import train_models, XGBoostPredictor, RandomForestPredictor

logger = logging.getLogger(__name__)


class RaceService:
    """Service for race data operations."""
    
    def __init__(self):
        self._sessions: Dict[str, dict] = {}
    
    def load_race(self, year: int, event: str, session_type: str = "Race") -> RaceLoadResponse:
        """Load race data from FastF1."""
        start_time = time.time()
        cache_key = f"{year}_{event}_{session_type}"
        
        cached = cache_key in self._sessions
        if not cached:
            try:
                session, laps, stats = load_race_session(year, event, session_type)
                cleaned_laps = clean_laps(laps)
                race_results = get_race_results(session)
                pit_strategies = get_pit_strategies(session)
                self._sessions[cache_key] = {
                    "session": session,
                    "stats": stats,
                    "clean_laps": cleaned_laps,
                    "race_results": race_results,
                    "pit_strategies": pit_strategies,
                }
            except Exception as e:
                raise ValueError(f"Failed to load session: {e}")
        
        load_time_ms = int((time.time() - start_time) * 1000)
        race_name = f"{event} {year}"
        session_id = cache_key
        
        return RaceLoadResponse(
            session_id=session_id,
            race_name=race_name,
            cached=cached,
            load_time_ms=load_time_ms,
        )
    
    def get_race_overview(self, session_id: str) -> RaceOverview:
        """Get race overview data."""
        if session_id not in self._sessions:
            raise ValueError(f"Session {session_id} not found.")
        
        session_payload = self._sessions[session_id]
        session = session_payload["session"]
        stats = session_payload["stats"]
        laps_df: pd.DataFrame = session_payload["clean_laps"]
        results_df: pd.DataFrame = session_payload["race_results"]
        pit_df: pd.DataFrame = session_payload["pit_strategies"]

        race_name = f"{stats.get('event', 'Unknown Race')} {stats.get('year', '')}".strip()
        track_name = getattr(session.event, "Location", "Unknown Track")
        date_value = getattr(session.event, "EventDate", None)
        date_str = date_value.isoformat() if date_value is not None else datetime.now().isoformat()

        total_drivers = int(stats.get("num_drivers", 0))
        total_laps = int(stats.get("total_laps", 0))
        avg_lap_time = float(laps_df["LapTime"].dt.total_seconds().mean()) if len(laps_df) else 0.0
        race_duration = avg_lap_time * total_laps if total_laps > 0 else 0.0
        
        metrics = RaceOverviewMetrics(
            race_name=race_name,
            date=date_str,
            track_name=track_name,
            total_drivers=total_drivers,
            total_laps=total_laps,
            avg_lap_time_seconds=avg_lap_time,
            race_duration_seconds=race_duration,
        )
        
        lap_times = self._extract_lap_times(laps_df)
        race_results = self._extract_race_results(results_df)
        pit_strategies = self._extract_pit_strategies(pit_df)
        tire_compounds = self._extract_tire_compounds(laps_df)
        best_laps = self._extract_best_laps(laps_df)
        
        return RaceOverview(
            session_id=session_id,
            metrics=metrics,
            lap_times=lap_times,
            race_results=race_results,
            pit_strategies=pit_strategies,
            tire_compounds=tire_compounds,
            best_laps=best_laps,
        )
    
    def _extract_lap_times(self, laps_df: pd.DataFrame) -> List[DriverLapTime]:
        """Extract lap times for all drivers."""
        lap_times = []
        if laps_df.empty:
            return lap_times

        sample = laps_df[["Driver", "LapNumber", "LapTime"]].dropna().head(800)
        for _, lap in sample.iterrows():
            try:
                driver_code = str(lap["Driver"])
                lap_seconds = lap["LapTime"].total_seconds()
                if 30 < lap_seconds < 300:
                    lap_times.append(DriverLapTime(
                        driver_code=driver_code,
                        driver_name=driver_code,
                        lap_number=int(lap["LapNumber"]),
                        lap_time_seconds=round(lap_seconds, 2),
                    ))
            except Exception:
                continue
        
        return lap_times
    
    def _extract_race_results(self, results_df: pd.DataFrame) -> List[RaceResult]:
        """Extract final race results."""
        race_results = []
        if results_df.empty:
            return race_results

        for _, result in results_df.iterrows():
            try:
                race_results.append(RaceResult(
                    position=int(result.get("Position", 0) or 0),
                    grid_position=int(result.get("GridPosition", 0) or 0),
                    driver_code=str(result.get("Driver", "UNK")),
                    driver_name=str(result.get("Driver", "UNK")),
                    headshot_url=(
                        str(result.get("HeadshotUrl")).strip()
                        if pd.notna(result.get("HeadshotUrl", None))
                        else None
                    ),
                    points=float(result.get("Points", 0) or 0),
                    status=str(result.get("Status", "Unknown")),
                    laps_completed=0,
                    time_diff_seconds=None,
                ))
            except Exception:
                continue
        
        return race_results
    
    def _extract_pit_strategies(self, pit_df: pd.DataFrame) -> List[PitStop]:
        pit_stops: List[PitStop] = []
        if pit_df.empty:
            return pit_stops

        for _, row in pit_df.iterrows():
            try:
                pit_stops.append(PitStop(
                    driver_code=str(row.get("Driver", "UNK")),
                    driver_name=str(row.get("Driver", "UNK")),
                    lap_number=int(row.get("LapEnd", 0) or 0),
                    compound=str(row.get("Compound", "Unknown")),
                    duration_seconds=float(row.get("AvgLapTime", 0.0) or 0.0),
                ))
            except Exception:
                continue
        return pit_stops
    
    def _extract_tire_compounds(self, laps_df: pd.DataFrame) -> List[TireCompound]:
        compounds = {}
        if laps_df.empty:
            return []

        for compound in laps_df["Compound"].fillna("Unknown"):
            compounds[compound] = compounds.get(compound, 0) + 1
        
        tire_list = []
        total = sum(compounds.values())
        
        for compound, count in sorted(compounds.items()):
            tire_list.append(TireCompound(
                compound=compound,
                count=count,
                percentage=round((count / total * 100), 1) if total > 0 else 0,
            ))
        
        return tire_list
    
    def _extract_best_laps(self, laps_df: pd.DataFrame) -> List[DriverBestLap]:
        if laps_df.empty:
            return []

        best_laps: List[DriverBestLap] = []
        valid = laps_df[["Driver", "LapNumber", "LapTime"]].dropna().copy()
        if valid.empty:
            return best_laps

        valid["LapSeconds"] = valid["LapTime"].dt.total_seconds()
        valid = valid[(valid["LapSeconds"] > 30) & (valid["LapSeconds"] < 300)]

        for driver, driver_laps in valid.groupby("Driver"):
            row = driver_laps.loc[driver_laps["LapSeconds"].idxmin()]
            best_laps.append(DriverBestLap(
                driver_code=str(driver),
                driver_name=str(driver),
                best_lap_time_seconds=round(float(row["LapSeconds"]), 2),
                lap_number=int(row["LapNumber"]),
            ))

        return sorted(best_laps, key=lambda x: x.best_lap_time_seconds)

    # ========================================================================
    # ML PREDICTIONS
    # ========================================================================

    def get_predictions(self, session_id: str, model_type: str = "xgboost") -> PredictionResponse:
        """Get ML predictions for lap times."""
        if session_id not in self._sessions:
            raise ValueError(f"Session {session_id} not found.")

        session_payload = self._sessions[session_id]
        laps_df: pd.DataFrame = session_payload["clean_laps"]
        results_df: pd.DataFrame = session_payload["race_results"]

        # Train models if not cached
        if "xgb_model" not in session_payload or "rf_model" not in session_payload:
            self._train_models(session_id)

        xgb_model: XGBoostPredictor = session_payload["xgb_model"]
        rf_model: RandomForestPredictor = session_payload["rf_model"]
        feat_df: pd.DataFrame = session_payload["feature_df"]
        feature_cols: List[str] = session_payload["feature_cols"]

        # Select model
        model = xgb_model if model_type == "xgboost" else rf_model

        # Get metrics
        metrics = ModelMetrics(
            mae=round(model.metrics.get("MAE", 0), 4),
            rmse=round(model.metrics.get("RMSE", 0), 4),
            r2=round(model.metrics.get("R2", 0), 4),
        )

        # Get feature importance
        feat_imp_df = model.get_feature_importance(top_n=10)
        feature_importance = [
            FeatureImportance(feature=row["Feature"], importance=round(row["Importance"], 4))
            for _, row in feat_imp_df.iterrows()
        ]

        # Generate predictions per driver
        driver_predictions = []
        for driver in feat_df["Driver"].unique():
            driver_data = feat_df[feat_df["Driver"] == driver].copy()
            if driver_data.empty:
                continue

            X = driver_data[feature_cols].values
            y_actual = driver_data["LapTime_sec"].values
            y_pred = model.predict(X)

            predictions = []
            for i, (_, row) in enumerate(driver_data.iterrows()):
                if i < len(y_pred):
                    predictions.append(LapPrediction(
                        lap_number=int(row["LapNumber"]),
                        actual_time_seconds=round(y_actual[i], 2),
                        predicted_time_seconds=round(y_pred[i], 2),
                        error_seconds=round(abs(y_actual[i] - y_pred[i]), 2),
                    ))

            if predictions:
                avg_error = sum(p.error_seconds for p in predictions) / len(predictions)
                driver_predictions.append(DriverPrediction(
                    driver_code=str(driver),
                    driver_name=str(driver),
                    predictions=predictions,
                    avg_error_seconds=round(avg_error, 2),
                ))

        return PredictionResponse(
            session_id=session_id,
            model_type=model_type,
            model_metrics=metrics,
            feature_importance=feature_importance,
            driver_predictions=driver_predictions,
        )

    def _train_models(self, session_id: str) -> None:
        """Train ML models for a session."""
        session_payload = self._sessions[session_id]
        laps_df: pd.DataFrame = session_payload["clean_laps"]
        results_df: pd.DataFrame = session_payload["race_results"]

        # Engineer features
        feat_df, feature_cols = engineer_features(laps_df, results_df)

        # Prepare train/test
        X_train, X_test, y_train, y_test, cols = prepare_train_test(feat_df, feature_cols)

        # Train models
        xgb_model, rf_model = train_models(X_train, X_test, y_train, y_test, cols)

        # Cache in session
        session_payload["feature_df"] = feat_df
        session_payload["feature_cols"] = feature_cols
        session_payload["xgb_model"] = xgb_model
        session_payload["rf_model"] = rf_model

        logger.info(f"✓ Trained models for session {session_id}")

    # ========================================================================
    # DRIVER ANALYSIS
    # ========================================================================

    def get_driver_analysis(self, session_id: str, driver_code: str) -> DriverAnalysisResponse:
        """Get detailed analysis for a specific driver."""
        if session_id not in self._sessions:
            raise ValueError(f"Session {session_id} not found.")

        session_payload = self._sessions[session_id]
        laps_df: pd.DataFrame = session_payload["clean_laps"]
        results_df: pd.DataFrame = session_payload["race_results"]
        pit_df: pd.DataFrame = session_payload["pit_strategies"]

        # Filter driver data
        driver_laps = laps_df[laps_df["Driver"] == driver_code].copy()
        if driver_laps.empty:
            raise ValueError(f"Driver {driver_code} not found in session.")

        # Get driver result
        driver_result = results_df[results_df["Driver"] == driver_code]
        if driver_result.empty:
            grid_position = 0
            final_position = 0
            points = 0.0
            team = None
        else:
            driver_result = driver_result.iloc[0]
            grid_position = int(driver_result.get("GridPosition", 0) or 0)
            final_position = int(driver_result.get("Position", 0) or 0)
            points = float(driver_result.get("Points", 0) or 0)
            team = str(driver_result.get("Team", "Unknown"))

        # Compute pace metrics
        lap_times_sec = driver_laps["LapTime"].dt.total_seconds()
        valid_times = lap_times_sec[(lap_times_sec > 30) & (lap_times_sec < 300)]

        if len(valid_times) > 0:
            avg_time = float(valid_times.mean())
            best_time = float(valid_times.min())
            std_time = float(valid_times.std()) if len(valid_times) > 1 else 0.0
            consistency = max(0, 100 - (std_time * 10))  # Higher std = lower consistency
        else:
            avg_time = 0.0
            best_time = 0.0
            std_time = 0.0
            consistency = 0.0

        pace_metrics = DriverPaceMetrics(
            avg_lap_time_seconds=round(avg_time, 2),
            best_lap_time_seconds=round(best_time, 2),
            std_lap_time_seconds=round(std_time, 2),
            consistency_score=round(consistency, 1),
        )

        # Analyze stints
        stints = self._analyze_stints(driver_laps, driver_code)

        # Get lap times
        lap_times = []
        for _, lap in driver_laps.iterrows():
            try:
                lap_sec = lap["LapTime"].total_seconds()
                if 30 < lap_sec < 300:
                    lap_times.append(DriverLapTime(
                        driver_code=driver_code,
                        driver_name=driver_code,
                        lap_number=int(lap["LapNumber"]),
                        lap_time_seconds=round(lap_sec, 2),
                    ))
            except Exception:
                continue

        return DriverAnalysisResponse(
            session_id=session_id,
            driver_code=driver_code,
            driver_name=driver_code,
            team=team,
            grid_position=grid_position,
            final_position=final_position,
            points=points,
            pace_metrics=pace_metrics,
            stints=stints,
            lap_times=lap_times,
        )

    def _analyze_stints(self, driver_laps: pd.DataFrame, driver_code: str) -> List[StintAnalysis]:
        """Analyze tire stints for a driver."""
        stints = []

        for stint_num in driver_laps["Stint"].unique():
            stint_data = driver_laps[driver_laps["Stint"] == stint_num].copy()
            if len(stint_data) < 2:
                continue

            lap_times = stint_data["LapTime"].dt.total_seconds()
            valid_times = lap_times[(lap_times > 30) & (lap_times < 300)]

            if len(valid_times) == 0:
                continue

            # Compute degradation rate
            tire_life = stint_data["TyreLife"].astype(float).values
            if len(tire_life) > 1 and tire_life[-1] > tire_life[0]:
                deg_rate = (valid_times.iloc[-1] - valid_times.iloc[0]) / (tire_life[-1] - tire_life[0])
            else:
                deg_rate = 0.0

            stints.append(StintAnalysis(
                stint_number=int(stint_num),
                compound=str(stint_data["Compound"].iloc[0]),
                lap_start=int(stint_data["LapNumber"].min()),
                lap_end=int(stint_data["LapNumber"].max()),
                lap_count=len(stint_data),
                avg_lap_time_seconds=round(float(valid_times.mean()), 2),
                best_lap_time_seconds=round(float(valid_times.min()), 2),
                degradation_rate=round(float(deg_rate), 3),
            ))

        return stints

    def get_drivers_list(self, session_id: str) -> List[str]:
        """Get list of drivers in a session."""
        if session_id not in self._sessions:
            raise ValueError(f"Session {session_id} not found.")

        session_payload = self._sessions[session_id]
        laps_df: pd.DataFrame = session_payload["clean_laps"]
        return list(laps_df["Driver"].unique())

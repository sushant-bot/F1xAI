"""
Race data API endpoints.
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List
import logging

from app.models.race import (
    RaceLoadResponse,
    RaceOverviewResponse,
    ErrorResponse,
    PredictionResponse,
    DriverAnalysisResponse,
    StrategyResponse,
    DriverStrategy,
    SimulationResponse,
    SimulationRequest,
    EnergyPhase,
)
from app.services.race_service import RaceService
from app.services.strategy_service import StrategyService
from app.services.simulation_service import SimulationService
from app.utils.exceptions import SessionLoadError, RaceNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/races", tags=["races"])
race_service = RaceService()
strategy_service = StrategyService()
simulation_service = SimulationService()


@router.get(
    "/load",
    response_model=RaceLoadResponse,
    summary="Load race data from FastF1",
    description="Load race session data from FastF1 API. Data is cached for 1 hour."
)
async def load_race(
    year: int = Query(..., description="Race year"),
    event: str = Query(..., description="Event name"),
    session_type: str = Query(default="Race", description="Session type")
):
    """
    Load race data from FastF1.

    This endpoint loads race session data including laps, results, and pit strategies.
    Data is cached for 1 hour to improve performance.

    **Parameters:**
    - **year**: Race year (e.g., 2023)
    - **event**: Full event name (e.g., "Bahrain Grand Prix")
    - **session_type**: Session type (default: "Race")

    **Returns:**
    - **session_id**: Unique session identifier for subsequent requests
    - **race_name**: Name of the race
    - **cached**: Whether data was loaded from cache
    - **load_time_ms**: Load time in milliseconds
    """
    try:
        result = race_service.load_race(year, event, session_type)
        return result
    except ValueError as e:
        logger.error(f"Session load error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get(
    "/{session_id}/overview",
    response_model=RaceOverviewResponse,
    summary="Get race overview data",
    description="Get complete race overview including metrics, lap times, results, and pit strategies."
)
async def get_race_overview(
    session_id: str
):
    """
    Get race overview data.

    This endpoint returns all data needed for the Overview page:
    - Race metrics (KPIs)
    - Lap times for all drivers
    - Race results table
    - Pit strategies
    - Tire compound distribution
    - Best laps ranking

    **Parameters:**
    - **session_id**: Session ID from /races/load endpoint

    **Returns:**
    - Complete race overview data
    """
    try:
        result = race_service.get_race_overview(session_id)
        return result
    except ValueError as e:
        logger.error(f"Race not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ============================================================================
# PREDICTIONS ENDPOINTS
# ============================================================================

@router.get(
    "/{session_id}/predictions",
    response_model=PredictionResponse,
    summary="Get ML predictions for lap times",
    description="Get lap time predictions from trained ML models (XGBoost or Random Forest)."
)
async def get_predictions(
    session_id: str,
    model_type: str = Query(default="xgboost", description="Model type: 'xgboost' or 'random_forest'")
):
    """
    Get ML predictions for lap times.

    This endpoint returns:
    - Model performance metrics (MAE, RMSE, R2)
    - Feature importance rankings
    - Per-driver lap time predictions with errors

    **Parameters:**
    - **session_id**: Session ID from /races/load endpoint
    - **model_type**: Model to use ('xgboost' or 'random_forest')
    """
    try:
        if model_type not in ["xgboost", "random_forest"]:
            raise HTTPException(status_code=400, detail="model_type must be 'xgboost' or 'random_forest'")

        result = race_service.get_predictions(session_id, model_type)
        return result
    except ValueError as e:
        logger.error(f"Session not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ============================================================================
# DRIVER ANALYSIS ENDPOINTS
# ============================================================================

@router.get(
    "/{session_id}/drivers",
    summary="Get list of drivers in session",
    description="Get list of all drivers in the session."
)
async def get_drivers(session_id: str):
    """
    Get list of drivers in a session.

    **Parameters:**
    - **session_id**: Session ID from /races/load endpoint
    """
    try:
        drivers = race_service.get_drivers_list(session_id)
        return {"session_id": session_id, "drivers": drivers}
    except ValueError as e:
        logger.error(f"Session not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting drivers: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get(
    "/{session_id}/drivers/{driver_code}/analysis",
    response_model=DriverAnalysisResponse,
    summary="Get detailed driver analysis",
    description="Get detailed analysis for a specific driver including pace metrics, stints, and lap times."
)
async def get_driver_analysis(
    session_id: str,
    driver_code: str
):
    """
    Get detailed analysis for a specific driver.

    This endpoint returns:
    - Driver pace metrics (avg, best, std, consistency)
    - Stint-by-stint analysis with degradation rates
    - Complete lap time history

    **Parameters:**
    - **session_id**: Session ID from /races/load endpoint
    - **driver_code**: Driver code (e.g., "VER", "HAM", "LEC")
    """
    try:
        result = race_service.get_driver_analysis(session_id, driver_code.upper())
        return result
    except ValueError as e:
        logger.error(f"Driver not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ============================================================================
# STRATEGY ENDPOINTS
# ============================================================================

@router.get(
    "/{session_id}/strategy",
    response_model=StrategyResponse,
    summary="Get race strategy recommendations",
    description="Get pit and energy strategy recommendations for all drivers."
)
async def get_race_strategy(
    session_id: str,
    race_length: Optional[int] = Query(default=None, description="Total race length in laps; auto-detected when omitted")
):
    """
    Get race strategy recommendations for all drivers.

    This endpoint returns:
    - Pit stop recommendations with optimal windows
    - Energy deployment strategy (boost/neutral/conserve phases)
    - Strategy summaries for each driver

    **Parameters:**
    - **session_id**: Session ID from /races/load endpoint
    - **race_length**: Total race length in laps (optional, auto-detected when omitted)
    """
    try:
        session_payload = race_service._sessions.get(session_id)
        if not session_payload:
            raise ValueError(f"Session {session_id} not found.")

        resolved_race_length = race_length
        if resolved_race_length is None:
            lap_numbers = session_payload["clean_laps"]["LapNumber"].dropna()
            resolved_race_length = int(lap_numbers.max()) if len(lap_numbers) else 57

        result = strategy_service.get_race_strategy(
            session_id,
            session_payload["clean_laps"],
            session_payload["race_results"],
            resolved_race_length,
        )
        return result
    except ValueError as e:
        logger.error(f"Session not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Strategy error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get(
    "/{session_id}/drivers/{driver_code}/strategy",
    response_model=DriverStrategy,
    summary="Get strategy for a specific driver",
    description="Get pit and energy strategy recommendations for a specific driver."
)
async def get_driver_strategy(
    session_id: str,
    driver_code: str,
    race_length: Optional[int] = Query(default=None, description="Total race length in laps; auto-detected when omitted")
):
    """
    Get strategy recommendations for a specific driver.

    **Parameters:**
    - **session_id**: Session ID from /races/load endpoint
    - **driver_code**: Driver code (e.g., "VER", "HAM", "LEC")
    - **race_length**: Total race length in laps (optional, auto-detected when omitted)
    """
    try:
        session_payload = race_service._sessions.get(session_id)
        if not session_payload:
            raise ValueError(f"Session {session_id} not found.")

        resolved_race_length = race_length
        if resolved_race_length is None:
            lap_numbers = session_payload["clean_laps"]["LapNumber"].dropna()
            resolved_race_length = int(lap_numbers.max()) if len(lap_numbers) else 57

        result = strategy_service.get_driver_strategy(
            session_id,
            driver_code.upper(),
            session_payload["clean_laps"],
            session_payload["race_results"],
            resolved_race_length,
        )
        return result
    except ValueError as e:
        logger.error(f"Driver/session not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Strategy error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ============================================================================
# SIMULATION ENDPOINTS
# ============================================================================

@router.post(
    "/{session_id}/simulate",
    response_model=SimulationResponse,
    summary="Run race simulation",
    description="Run race simulation with custom energy strategies."
)
async def simulate_race(
    session_id: str,
    requests: Optional[List[SimulationRequest]] = Body(default=None, description="Simulation requests per driver")
):
    """
    Run race simulation with custom energy strategies.

    If no requests are provided, simulates all drivers with default strategy.

    **Request Body:**
    ```json
    [
        {
            "driver_code": "VER",
            "strategy": [
                {"lap_start": 1, "lap_end": 30, "mode": "neutral"},
                {"lap_start": 31, "lap_end": 57, "mode": "boost"}
            ]
        }
    ]
    ```

    **Returns:**
    - Simulated lap times for each driver
    - Time gained/lost compared to original
    - Energy state throughout race
    """
    try:
        session_payload = race_service._sessions.get(session_id)
        if not session_payload:
            raise ValueError(f"Session {session_id} not found.")

        result = simulation_service.simulate_race(
            session_id,
            session_payload["clean_laps"],
            session_payload["race_results"],
            requests,
        )
        return result
    except ValueError as e:
        logger.error(f"Session not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Simulation error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post(
    "/{session_id}/drivers/{driver_code}/simulate",
    response_model=SimulationResponse,
    summary="Simulate race for a specific driver",
    description="Run race simulation for a specific driver with custom energy strategy."
)
async def simulate_driver(
    session_id: str,
    driver_code: str,
    strategy: List[EnergyPhase] = Body(..., description="Energy strategy phases")
):
    """
    Simulate race for a specific driver.

    **Request Body:**
    ```json
    [
        {"lap_start": 1, "lap_end": 25, "mode": "conserve"},
        {"lap_start": 26, "lap_end": 40, "mode": "neutral"},
        {"lap_start": 41, "lap_end": 57, "mode": "boost"}
    ]
    ```

    **Returns:**
    - Simulated lap times
    - Time gained/lost compared to original
    - Energy state throughout race
    """
    try:
        session_payload = race_service._sessions.get(session_id)
        if not session_payload:
            raise ValueError(f"Session {session_id} not found.")

        result = simulation_service.simulate_driver(
            session_id,
            driver_code.upper(),
            strategy,
            session_payload["clean_laps"],
            session_payload["race_results"],
        )

        # Wrap in response
        return SimulationResponse(
            session_id=session_id,
            results=[result],
            summary=f"Simulated {driver_code}: {result.time_gained_seconds:+.2f} sec gained",
        )
    except ValueError as e:
        logger.error(f"Driver/session not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Simulation error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
"""
Telemetry-based race replay traces (SessionTime -> RelativeDistance on lap), same
concept as IAmTomShaw/f1-race-replay (FastF1 lap.get_telemetry() per lap).
Used by the web UI to place cars on the SVG circuit using real car progress.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from fastf1.core import Session

logger = logging.getLogger(__name__)

MAX_SAMPLES_PER_DRIVER = 2800


def _subsample(t: np.ndarray, y: np.ndarray, max_n: int) -> Tuple[np.ndarray, np.ndarray]:
    if len(t) <= max_n:
        return t, y
    idx = np.linspace(0, len(t) - 1, max_n).astype(int)
    return t[idx], y[idx]


def _driver_number_to_code(session: Session) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    try:
        for _, row in session.results.iterrows():
            num = row.get("DriverNumber")
            abbr = row.get("Abbreviation")
            if pd.isna(num) or pd.isna(abbr):
                continue
            mapping[str(int(num))] = str(abbr).strip()
    except Exception as exc:
        logger.warning("Could not build driver number map: %s", exc)
    return mapping


def _leader_driver_number(session: Session) -> Optional[str]:
    try:
        res = session.results.sort_values("Position")
        for _, row in res.iterrows():
            pos = row.get("Position")
            num = row.get("DriverNumber")
            if pd.isna(pos) or pd.isna(num):
                continue
            if int(pos) == 1:
                return str(int(num))
    except Exception as exc:
        logger.warning("Could not resolve race leader: %s", exc)
    return None


def _leader_lap_timings(session: Session, leader_num: str) -> List[Dict[str, float]]:
    laps = session.laps.pick_drivers(leader_num)
    if laps is None or laps.empty:
        return []

    rows: List[Dict[str, float]] = []
    try:
        ordered = laps.sort_values("LapNumber")
    except Exception:
        ordered = laps

    for _, row in ordered.iterrows():
        try:
            lap_no = int(row["LapNumber"])
        except (TypeError, ValueError):
            continue
        if lap_no < 1:
            continue
        lst = row.get("LapStartTime")
        lt = row.get("LapTime")
        if lst is None or lt is None or pd.isna(lst) or pd.isna(lt):
            continue
        dur = float(lt.total_seconds())
        if dur < 15 or dur > 600:
            continue
        start = float(lst.total_seconds())
        rows.append({"lap": float(lap_no), "start": start, "dur": dur})

    # De-duplicate lap numbers (keep first)
    seen = set()
    unique: List[Dict[str, float]] = []
    for r in sorted(rows, key=lambda x: x["lap"]):
        ln = int(r["lap"])
        if ln in seen:
            continue
        seen.add(ln)
        unique.append({"lap": float(ln), "start": r["start"], "dur": r["dur"]})
    return unique


def _trace_for_driver(session: Session, driver_num: str) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    """
    One merged telemetry stream per driver (FastF1), same data as f1-race-replay's
    per-lap concat but ~20× faster than iterlaps().
    """
    laps_driver = session.laps.pick_drivers(driver_num)
    if laps_driver is None or laps_driver.empty:
        return None

    try:
        tel = laps_driver.get_telemetry()
    except Exception as exc:
        logger.warning("get_telemetry failed for driver %s: %s", driver_num, exc)
        return None

    if tel is None or tel.empty:
        return None
    if "SessionTime" not in tel.columns or "RelativeDistance" not in tel.columns:
        return None

    t_sec = tel["SessionTime"].dt.total_seconds().to_numpy(dtype=np.float64)
    rd = tel["RelativeDistance"].to_numpy(dtype=np.float64)
    valid = np.isfinite(t_sec) & np.isfinite(rd)
    t_sec = t_sec[valid]
    rd = rd[valid]
    if len(t_sec) < 2:
        return None

    rd = np.clip(rd, 0.0, 1.0)
    order = np.argsort(t_sec)
    t_sec = t_sec[order]
    rd = rd[order]

    if len(t_sec) > 1:
        uniq_mask = np.concatenate([[True], np.diff(t_sec) > 1e-6])
        t_sec = t_sec[uniq_mask]
        rd = rd[uniq_mask]

    t_sec, rd = _subsample(t_sec, rd, MAX_SAMPLES_PER_DRIVER)
    return t_sec, rd


def build_replay_telemetry(session: Session) -> Optional[Dict[str, Any]]:
    """
    Build compact traces for the frontend replay.
    Returns None if telemetry is unavailable.
    """
    leader_num = _leader_driver_number(session)
    if not leader_num:
        logger.warning("replay_telemetry: no leader driver number")
        return None

    num_to_code = _driver_number_to_code(session)
    leader_code = num_to_code.get(leader_num)
    if not leader_code:
        logger.warning("replay_telemetry: leader code missing")
        return None

    lap_timings = _leader_lap_timings(session, leader_num)
    if not lap_timings:
        logger.warning("replay_telemetry: no leader lap timings")
        return None

    drivers_payload: Dict[str, Dict[str, List[float]]] = {}
    drivers_list = session.drivers if isinstance(session.drivers, list) else session.drivers.tolist()

    for drv in drivers_list:
        drv_str = str(drv)
        trace = _trace_for_driver(session, drv_str)
        if trace is None:
            continue
        t_arr, rd_arr = trace
        code = num_to_code.get(drv_str, drv_str)
        drivers_payload[code] = {
            "t": t_arr.astype(float).tolist(),
            "rel_dist": rd_arr.astype(float).tolist(),
        }

    if len(drivers_payload) < 3:
        logger.warning("replay_telemetry: too few driver traces (%s)", len(drivers_payload))
        return None

    return {
        "leader_code": leader_code,
        "leader_lap_timings": lap_timings,
        "drivers": drivers_payload,
    }

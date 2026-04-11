"""
Derive per-lap track conditions from FastF1 session.track_status (SC / VSC / yellow).
Same underlying data as projects like f1-race-replay; we only expose lap-level flags for the web UI.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import pandas as pd
from fastf1.core import Session

logger = logging.getLogger(__name__)

_STATUS_SC = {"4"}
_STATUS_VSC = {"6", "7"}
_STATUS_YELLOW = {"2", "3"}


def _classify_status(code: str) -> str:
    s = str(code).strip()
    if s in _STATUS_SC:
        return "sc"
    if s in _STATUS_VSC:
        return "vsc"
    if s in _STATUS_YELLOW:
        return "yellow"
    return "green"


_SEVERITY = {"green": 0, "yellow": 1, "vsc": 2, "sc": 3}


def extract_lap_track_flags(session: Session) -> List[Dict[str, Any]]:
    """
    For each race lap, report the most severe track condition overlapping that lap's time window.
    """
    ts = getattr(session, "track_status", None)
    if ts is None or not isinstance(ts, pd.DataFrame) or ts.empty:
        return []

    if "Time" not in ts.columns or "Status" not in ts.columns:
        logger.warning("track_status missing Time/Status columns")
        return []

    laps = session.laps
    if laps is None or laps.empty or "LapNumber" not in laps.columns:
        return []

    race_laps = laps[(laps["LapNumber"].notna()) & (laps["LapNumber"] > 0)]
    if race_laps.empty:
        return []

    try:
        grouped = (
            race_laps.groupby("LapNumber", sort=True)
            .agg(
                lap_start=("LapStartTime", "min"),
                lap_time=("LapTime", "min"),
            )
            .reset_index()
        )
    except (TypeError, KeyError, ValueError) as exc:
        logger.warning("Could not aggregate lap timings for track flags: %s", exc)
        return []

    ts_sorted = ts.sort_values("Time").reset_index(drop=True)
    times = ts_sorted["Time"].tolist()
    statuses = ts_sorted["Status"].astype(str).tolist()

    flags: List[Dict[str, Any]] = []

    for _, row in grouped.iterrows():
        lap_no = int(row["LapNumber"])
        lap_start = row["lap_start"]
        lap_time = row["lap_time"]
        if pd.isna(lap_start) or pd.isna(lap_time):
            continue
        try:
            lap_end = lap_start + lap_time
        except (TypeError, ValueError):
            continue

        worst = "green"
        for i, t0 in enumerate(times):
            t1 = times[i + 1] if i + 1 < len(times) else lap_end + pd.Timedelta(seconds=1)
            cond = _classify_status(statuses[i])
            if cond == "green":
                continue
            # overlap lap window [lap_start, lap_end] with [t0, t1)
            if t1 <= lap_start or t0 >= lap_end:
                continue
            if _SEVERITY[cond] > _SEVERITY[worst]:
                worst = cond

        if worst != "green":
            flags.append({"lap_number": lap_no, "condition": worst})

    return flags

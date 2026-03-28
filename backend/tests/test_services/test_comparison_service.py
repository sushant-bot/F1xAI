import pandas as pd

from app.models.race import (
    DriverBestLap,
    DriverLapTime,
    PitStop,
    RaceLoadResponse,
    RaceOverview,
    RaceOverviewMetrics,
    RaceResult,
    TireCompound,
)
from app.services.comparison_service import ComparisonService


class FakeRaceService:
    def __init__(self, overviews, teams_by_year):
        self._overviews = overviews
        self._sessions = {
            f"session-{year}": {
                "race_results": pd.DataFrame(
                    [{"Driver": "HAM", "Team": team}]
                )
            }
            for year, team in teams_by_year.items()
        }

    def load_race(self, year, event_name, session_type):
        if year not in self._overviews:
            raise ValueError(f"Missing season {year}")

        return RaceLoadResponse(
            session_id=f"session-{year}",
            race_name=f"{event_name} {year}",
            cached=True,
            load_time_ms=0,
        )

    def get_race_overview(self, session_id):
        year = int(session_id.rsplit("-", 1)[1])
        return self._overviews[year]


def make_overview(year, finish_position, avg_lap_time):
    lap_times = [
        DriverLapTime(
            driver_code="HAM",
            driver_name="Lewis Hamilton",
            lap_number=lap_number,
            lap_time_seconds=round(avg_lap_time + lap_number * 0.05, 3),
        )
        for lap_number in range(1, 13)
    ]

    return RaceOverview(
        session_id=f"session-{year}",
        metrics=RaceOverviewMetrics(
            race_name=f"Bahrain Grand Prix {year}",
            date=f"{year}-03-20T00:00:00",
            track_name="Bahrain",
            total_drivers=1,
            total_laps=57,
            avg_lap_time_seconds=avg_lap_time,
            race_duration_seconds=avg_lap_time * 57,
        ),
        lap_times=lap_times,
        race_results=[
            RaceResult(
                position=finish_position,
                grid_position=2,
                driver_code="HAM",
                driver_name="Lewis Hamilton",
                points=25.0 if finish_position == 1 else 18.0,
                status="Finished",
                laps_completed=57,
            )
        ],
        pit_strategies=[
            PitStop(
                driver_code="HAM",
                driver_name="Lewis Hamilton",
                lap_number=18,
                compound="MEDIUM",
                duration_seconds=22.0,
            )
        ],
        tire_compounds=[
            TireCompound(compound="MEDIUM", count=12, percentage=100.0)
        ],
        best_laps=[
            DriverBestLap(
                driver_code="HAM",
                driver_name="Lewis Hamilton",
                best_lap_time_seconds=avg_lap_time - 0.8,
                lap_number=7,
            )
        ],
    )


def test_compare_track_seasons_uses_only_loaded_years_for_trends():
    race_service = FakeRaceService(
        overviews={
            2021: make_overview(2021, 1, 91.2),
            2024: make_overview(2024, 2, 89.4),
        },
        teams_by_year={2021: "Mercedes", 2024: "Ferrari"},
    )
    service = ComparisonService(race_service)

    result = service.compare_track_seasons(
        "Bahrain",
        [2021, 2023, 2024],
        "Bahrain Grand Prix",
    )

    assert result.years == [2021, 2024]
    assert result.pace_trend.years == [2021, 2024]
    assert result.degradation_trend.years == [2021, 2024]


def test_compare_track_seasons_uses_session_team_mapping_for_driver_history():
    race_service = FakeRaceService(
        overviews={
            2021: make_overview(2021, 1, 91.2),
            2022: make_overview(2022, 2, 90.3),
        },
        teams_by_year={2021: "Mercedes", 2022: "Ferrari"},
    )
    service = ComparisonService(race_service)

    result = service.compare_track_seasons(
        "Bahrain",
        [2021, 2022],
        "Bahrain Grand Prix",
    )

    assert len(result.driver_comparisons) == 1
    assert [season.team for season in result.driver_comparisons[0].seasons] == [
        "Mercedes",
        "Ferrari",
    ]


def test_predict_next_race_reports_only_loaded_history_years():
    race_service = FakeRaceService(
        overviews={
            2021: make_overview(2021, 1, 91.2),
            2024: make_overview(2024, 2, 89.4),
        },
        teams_by_year={2021: "Mercedes", 2024: "Ferrari"},
    )
    service = ComparisonService(race_service)

    prediction = service.predict_next_race(
        "Bahrain",
        [2021, 2023, 2024],
        "Bahrain Grand Prix",
        2025,
    )

    assert prediction.based_on_years == [2021, 2024]

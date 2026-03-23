from app.services.race_service import RaceService


def test_get_race_overview_requires_loaded_session():
    service = RaceService()

    try:
        service.get_race_overview("missing-session")
        assert False, "Expected ValueError for missing session"
    except ValueError as exc:
        assert "not found" in str(exc)

"""
Custom exceptions for Apex26 API.
"""

from fastapi import HTTPException, status


class Apex26Exception(Exception):
    """Base exception for Apex26 API."""
    pass


class RaceNotFoundError(Apex26Exception):
    """Raised when race data cannot be found."""
    pass


class SessionLoadError(Apex26Exception):
    """Raised when FastF1 session fails to load."""
    pass


class DataQualityError(Apex26Exception):
    """Raised when data quality is insufficient."""
    pass


class ModelNotTrainedError(Apex26Exception):
    """Raised when attempting to use untrained model."""
    pass


class SimulationError(Apex26Exception):
    """Raised when simulation fails."""
    pass


class CacheError(Apex26Exception):
    """Raised when cache operations fail."""
    pass


# HTTP Exception helpers
def raise_not_found(message: str = "Resource not found"):
    """Raise HTTP 404 Not Found."""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=message
    )


def raise_bad_request(message: str = "Bad request"):
    """Raise HTTP 400 Bad Request."""
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=message
    )


def raise_internal_error(message: str = "Internal server error"):
    """Raise HTTP 500 Internal Server Error."""
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=message
    )

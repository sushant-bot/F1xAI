"""
Main FastAPI application for Apex26 API.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import (
    PROJECT_NAME,
    VERSION,
    DESCRIPTION,
    API_V1_PREFIX,
    CORS_ORIGINS,
    DEBUG_MODE
)
from app.api.v1.endpoints import race_data

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG_MODE else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=PROJECT_NAME,
    description=DESCRIPTION,
    version=VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{API_V1_PREFIX}/openapi.json"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(race_data.router, prefix=API_V1_PREFIX)


@app.get("/", tags=["root"])
async def root():
    """Root endpoint."""
    return {
        "name": PROJECT_NAME,
        "version": VERSION,
        "description": DESCRIPTION,
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", tags=["root"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": VERSION
    }


@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    logger.info(f"Starting {PROJECT_NAME} v{VERSION}")
    logger.info(f"API documentation: http://localhost:8000/docs")
    logger.info(f"CORS origins: {CORS_ORIGINS}")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    logger.info(f"Shutting down {PROJECT_NAME}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=DEBUG_MODE
    )

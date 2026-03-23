# Apex26: F1 Race Strategy & Energy Simulation Platform

A full-stack F1 strategy and energy simulation platform using real telemetry data from FastF1.

## Overview

Apex26 combines:
1. **Data Engineering**: Extract race data using FastF1 telemetry
2. **ML Prediction**: Train models (XGBoost, Random Forest) to predict race pace and outcomes
3. **Rule-Based Simulation**: Energy deployment + pit strategy logic
4. **Interactive Dashboard**: Visualize lap trends, degradation curves, and strategy outputs

## Project Structure

```
apex26/
├── data/
│   ├── loader.py        # FastF1 session loading + caching
│   └── cleaner.py       # Data quality filtering, pit strategy extraction
├── ml/
│   ├── features.py      # Feature engineering (pace, degradation, tire history)
│   └── models.py        # XGBoost + Random Forest training/inference
├── sim/
│   ├── energy.py        # Energy model (boost/harvest rules)
│   └── strategy.py      # Pit window + push/conserve decision logic
├── ui/
│   ├── app.py           # Streamlit entrypoint
│   └── pages/           # Multi-page Streamlit dashboard
├── config.py            # Centralized configuration (paths, hyperparams, race selection)
├── requirements.txt     # Python dependencies
└── README.md
```

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Load and Clean Data
```python
from data.loader import load_race
from data.cleaner import clean_laps
from config import PRIMARY_RACE

# Load Bahrain 2023
session, raw_laps, stats = load_race(**PRIMARY_RACE)

# Clean for pace analysis
clean = clean_laps(raw_laps)

print(f"Cleaned {len(clean)} laps from {len(stats['drivers'])} drivers")
```

### 3. Run Dashboard (Coming Next)
```bash
streamlit run ui/app.py
```

## Current Status

✅ **Phase 1 Complete**: Foundation & Data Pipeline
- FastF1 data loader with caching
- Data cleaning (pit filtering, quality checks)
- Basic aggregation (driver stats, tire degradation)

🔄 **Phase 2**: Feature Engineering & ML Models (In Progress)
- Feature engineering (grid, pace, degradation, pit history)
- XGBoost + Random Forest training
- Feature importance extraction

## Key Features (Planned)

- **Lap-level pace prediction** using ML models trained on real telemetry
- **Tire degradation curves** to identify optimal pit windows
- **Energy simulation** with boost/conserve/neutral modes
- **Interactive what-if scenarios**: Adjust pit lap, energy strategy, see impact on finish position
- **Feature explainability**: Understand which factors drive pace changes
- **Cross-race backtesting**: Validate models on Saudi Arabia, Australia, Japan 2023

## Configuration

All hyperparameters, race selection, and simulation rules are in [config.py](config.py):

- **XGBoost**: max_depth=5, lr=0.1, n_estimators=100
- **Random Forest**: max_depth=8, n_estimators=100
- **Energy Model**: boost (-0.3 sec/lap), conserve (+0.1 sec/lap), neutral (0)
- **Primary Race**: Bahrain 2023 (MVP)
- **Backtesting Races**: Saudi Arabia, Australia, Azerbaijan, Japan 2023

## Data Source

All data is extracted from [FastF1](https://github.com/theOehrly/FastF1), which provides official F1 telemetry, timing, and session data.


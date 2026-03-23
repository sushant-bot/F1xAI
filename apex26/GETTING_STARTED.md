# Getting Started with Apex26

Quick start guide to get Apex26 running in 5 minutes.

## Installation

```bash
# 1. Navigate to project
cd apex26

# 2. Install dependencies
pip install -r requirements.txt

# 3. Verify installation
python test_pipeline.py
```

Expected output: `✅ ALL TESTS PASSED!`

## Running the Dashboard

```bash
# Start Streamlit app
streamlit run ui/app.py
```

Opens at: http://localhost:8501

## Dashboard Overview

1. **Overview Page** 🏁
   - Race summary, lap times, results table
   - See all drivers' pace over the race

2. **Analysis Page** 📊
   - Select a driver
   - View degradation curves, position progress, pit history
   - Understand what happened in their race

3. **Predictions Page** 🎯
   - What-if: adjust pit lap, energy mode
   - See simulated vs actual lap times
   - View model feature importance
   - Get pit recommendations

## Run Tests

```bash
# End-to-end validation
python test_pipeline.py

# Backtest on multiple races
python backtest.py
```

## Folder Structure

```
apex26/
├── data/       # Data loading and cleaning
├── ml/         # Feature engineering and models
├── sim/        # Energy and strategy simulation
├── ui/         # Streamlit dashboard
├── config.py   # All settings
└── test_pipeline.py, backtest.py
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `streamlit run ui/app.py` | Launch dashboard |
| `python test_pipeline.py` | Validate pipeline |
| `python backtest.py` | Test on multiple races |
| `python -c "from data.loader import load_race; load_race(2023, 'Bahrain Grand Prix', 'Race')"` | Load race data |

## Customize Settings

Edit `config.py` to:
- Change primary race (line ~15)
- Adjust ML hyperparams (lines ~50-65)
- Modify energy rules (lines ~68-75)

## Troubleshooting

**FastF1 download slow?**
- Data is cached locally in `data/cache/`
- First run downloads from API (~2 min)
- Subsequent runs use cache (~1 sec)

**Dashboard shows "No data loaded"?**
- Clear Streamlit cache: Press **C** in sidebar
- Restart: `streamlit run ui/app.py`

**Model training takes long?**
- First time: loads data from FastF1 (~1 min)
- Trains models (~30 sec)
- Subsequent runs use caching

## Next Steps

1. ✅ Verify tests pass
2. ✅ Launch dashboard
3. ✅ Explore Bahrain 2023 race
4. ✅ Check feature importance
5. ✅ Try what-if scenarios
6. 📖 Read full README_FULL.md for details

## More Info

- Full documentation: [README_FULL.md](README_FULL.md)
- Implementation plan: `/memories/session/plan.md`
- Config reference: [config.py](config.py)

---

**Apex26** is a full-stack F1 strategy simulation platform. Built with FastF1, XGBoost, and Streamlit.

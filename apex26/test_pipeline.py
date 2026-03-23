"""
Apex26 End-to-End Test Script
Validates data loading, feature engineering, ML training, and simulation.
Run with: python test_pipeline.py
"""

import logging
import sys
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s - %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)


def test_data_pipeline():
    """Test data loading and cleaning."""
    print("\n" + "=" * 70)
    print("TEST 1: DATA PIPELINE")
    print("=" * 70)
    
    try:
        from config import PRIMARY_RACE
        from data.loader import load_race, get_race_results, get_pit_strategies
        from data.cleaner import clean_laps, get_driver_stats, get_tire_degradation, validate_data_integrity
        
        logger.info("Loading race data...")
        session, raw_laps, stats = load_race(**PRIMARY_RACE)
        
        assert len(raw_laps) > 0, "Raw laps empty"
        assert stats["num_drivers"] > 0, "No drivers found"
        print(f"[OK] Loaded {stats['num_drivers']} drivers, {len(raw_laps)} total laps")
        
        logger.info("Cleaning laps...")
        clean = clean_laps(raw_laps)
        
        assert len(clean) > 0, "No clean laps"
        assert len(clean) <= len(raw_laps), "Cleaned data larger than raw"
        print(f"[OK] Cleaned: {len(clean)} / {len(raw_laps)} laps ({100*len(clean)/len(raw_laps):.1f}%)")
        
        logger.info("Getting driver stats...")
        driver_stats = get_driver_stats(clean)
        
        assert len(driver_stats) > 0, "No driver stats"
        print(f"[OK] Driver stats: {len(driver_stats)} drivers")
        
        logger.info("Getting tire degradation...")
        degradation = get_tire_degradation(clean)
        
        assert len(degradation) > 0, "No degradation data"
        print(f"[OK] Degradation: {len(degradation)} compound combinations")
        
        logger.info("Validating data integrity...")
        integrity = validate_data_integrity(clean)
        
        assert all(integrity.values()), f"Data integrity check failed: {integrity}"
        print(f"[OK] Data integrity: All checks passed")
        
        logger.info("Getting race results...")
        results = get_race_results(session)
        
        assert len(results) > 0, "No race results"
        print(f"[OK] Race results: {len(results)} drivers")
        
        logger.info("Getting pit strategies...")
        pit_strats = get_pit_strategies(session)
        
        assert len(pit_strats) > 0, "No pit strategies"
        print(f"[OK] Pit strategies: {len(pit_strats)} stints")
        
        print("\n[PASS] DATA PIPELINE: PASSED")
        return True, {"session": session, "clean": clean, "results": results, "pit_strats": pit_strats}
    
    except AssertionError as e:
        print(f"\n[FAIL] DATA PIPELINE: FAILED - {e}")
        return False, {}
    except Exception as e:
        print(f"\n[FAIL] DATA PIPELINE: ERROR - {e}")
        import traceback
        traceback.print_exc()
        return False, {}


def test_feature_engineering(data):
    """Test feature engineering."""
    print("\n" + "=" * 70)
    print("TEST 2: FEATURE ENGINEERING")
    print("=" * 70)
    
    try:
        from ml.features import engineer_features, prepare_train_test
        
        clean = data["clean"]
        results = data["results"]
        
        logger.info("Engineering features...")
        feat_df, feat_cols = engineer_features(clean, results)
        
        assert len(feat_df) > 0, "No engineered features"
        assert len(feat_cols) > 0, "No feature columns"
        print(f"[OK] Features: {len(feat_df)} samples, {len(feat_cols)} features")
        
        logger.info("Preparing train/test...")
        X_train, X_test, y_train, y_test, cols = prepare_train_test(feat_df, feat_cols)
        
        assert len(X_train) > 0, "No training data"
        assert len(X_test) > 0, "No test data"
        assert len(X_train) > len(X_test), "More test data than train data"
        print(f"[OK] Train/test split: {len(X_train)} train, {len(X_test)} test")
        
        print("\n[PASS] FEATURE ENGINEERING: PASSED")
        return True, {"X_train": X_train, "X_test": X_test, "y_train": y_train, "y_test": y_test, "feat_cols": cols}
    
    except AssertionError as e:
        print(f"\n[FAIL] FEATURE ENGINEERING: FAILED - {e}")
        return False, {}
    except Exception as e:
        print(f"\n[FAIL] FEATURE ENGINEERING: ERROR - {e}")
        import traceback
        traceback.print_exc()
        return False, {}


def test_ml_models(ml_data):
    """Test ML model training and evaluation."""
    print("\n" + "=" * 70)
    print("TEST 3: ML MODELS")
    print("=" * 70)
    
    try:
        from ml.models import train_models, compare_feature_importance
        
        X_train = ml_data["X_train"]
        X_test = ml_data["X_test"]
        y_train = ml_data["y_train"]
        y_test = ml_data["y_test"]
        feat_cols = ml_data["feat_cols"]
        
        logger.info("Training models...")
        xgb_model, rf_model = train_models(X_train, X_test, y_train, y_test, feat_cols)
        
        assert xgb_model.model is not None, "XGBoost model not trained"
        assert rf_model.model is not None, "Random Forest model not trained"
        print(f"[OK] Models trained: XGBoost, Random Forest")
        
        # Check metrics
        assert "MAE" in xgb_model.metrics, "No MAE in XGBoost metrics"
        assert xgb_model.metrics["MAE"] > 0, "Invalid MAE"
        print(f"[OK] XGBoost - MAE: {xgb_model.metrics['MAE']:.4f}s, RMSE: {xgb_model.metrics['RMSE']:.4f}s, R2: {xgb_model.metrics['R2']:.4f}")
        
        assert "MAE" in rf_model.metrics, "No MAE in RF metrics"
        assert rf_model.metrics["MAE"] > 0, "Invalid MAE"
        print(f"[OK] Random Forest - MAE: {rf_model.metrics['MAE']:.4f}s, RMSE: {rf_model.metrics['RMSE']:.4f}s, R2: {rf_model.metrics['R2']:.4f}")
        
        # Check feature importance
        xgb_imp = xgb_model.get_feature_importance(top_n=5)
        rf_imp = rf_model.get_feature_importance(top_n=5)
        
        assert len(xgb_imp) > 0, "No XGBoost feature importance"
        assert len(rf_imp) > 0, "No RF feature importance"
        print(f"[OK] Feature importance extracted: XGBoost & Random Forest")
        
        print("\n[PASS] ML MODELS: PASSED")
        return True, {"xgb_model": xgb_model, "rf_model": rf_model}
    
    except AssertionError as e:
        print(f"\n[FAIL] ML MODELS: FAILED - {e}")
        return False, {}
    except Exception as e:
        print(f"\n[FAIL] ML MODELS: ERROR - {e}")
        import traceback
        traceback.print_exc()
        return False, {}


def test_simulation(data):
    """Test energy simulation and strategy engine."""
    print("\n" + "=" * 70)
    print("TEST 4: SIMULATION")
    print("=" * 70)
    
    try:
        from sim.energy import EnergySimulator, create_default_strategy
        from sim.strategy import StrategyEngine
        
        clean = data["clean"]
        
        # Test energy simulator
        logger.info("Testing energy simulator...")
        
        sim = EnergySimulator()
        
        # Get laps for a driver
        driver = clean["Driver"].unique()[0]
        driver_laps = clean[clean["Driver"] == driver].copy()
        driver_laps["LapTime_sec"] = driver_laps["LapTime"].dt.total_seconds()
        
        # Create strategy
        strategy = create_default_strategy(len(driver_laps))
        
        assert len(strategy) > 0, "No strategy created"
        print(f"[OK] Strategy created: {len(strategy)} phases")
        
        # Simulate
        simulated = sim.simulate_race(driver_laps, strategy)
        
        assert len(simulated) == len(driver_laps), "Simulated laps count mismatch"
        assert "SimulatedLapTime" in simulated.columns, "No simulated lap time"
        assert "EnergyState" in simulated.columns, "No energy state"
        print(f"[OK] Simulation complete: {len(simulated)} laps simulated")
        
        # Test strategy engine
        logger.info("Testing strategy engine...")
        
        engine = StrategyEngine()
        
        pit_recs = engine.recommend_pit_lap(driver_laps, driver)
        
        assert pit_recs is not None, "No pit recommendation"
        assert "PitRecommendations" in pit_recs, "No pit recommendations in result"
        print(f"[OK] Pit strategy: {len(pit_recs['PitRecommendations'])} recommendations")
        
        energy_strat = engine.recommend_energy_strategy(current_position=5, grid_position=10)
        
        assert len(energy_strat) > 0, "No energy strategy"
        print(f"[OK] Energy strategy: {len(energy_strat)} phases")
        
        print("\n[PASS] SIMULATION: PASSED")
        return True, {}
    
    except AssertionError as e:
        print(f"\n[FAIL] SIMULATION: FAILED - {e}")
        return False, {}
    except Exception as e:
        print(f"\n[FAIL] SIMULATION: ERROR - {e}")
        import traceback
        traceback.print_exc()
        return False, {}


def main():
    """Run all tests."""
    print("\n" + "[FLAG] APEX26 END-TO-END TEST SUITE [FLAG]".center(70))
    
    results = {
        "data_pipeline": False,
        "feature_engineering": False,
        "ml_models": False,
        "simulation": False,
    }
    
    # Test 1: Data Pipeline
    passed, data = test_data_pipeline()
    results["data_pipeline"] = passed
    
    if not passed:
        print("\n[FAIL] TESTS FAILED - Stopping (data pipeline required)")
        return results
    
    # Test 2: Feature Engineering
    passed, ml_data = test_feature_engineering(data)
    results["feature_engineering"] = passed
    
    if not passed:
        print("\n[FAIL] TESTS FAILED - Stopping (feature engineering required)")
        return results
    
    # Test 3: ML Models
    passed, model_data = test_ml_models(ml_data)
    results["ml_models"] = passed
    
    # Test 4: Simulation
    passed, _ = test_simulation(data)
    results["simulation"] = passed
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    all_passed = all(results.values())
    
    for test, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{test:30s}: {status}")
    
    if all_passed:
        print("\n" + "=" * 70)
        print("[PASS] ALL TESTS PASSED!")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        print("[FAIL] SOME TESTS FAILED")
        print("=" * 70)
    
    return results


if __name__ == "__main__":
    results = main()
    sys.exit(0 if all(results.values()) else 1)

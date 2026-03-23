"""
Apex26 Backtesting Script
Trains model on primary race (Bahrain) and evaluates on additional races.
Run with: python backtest.py
"""

import logging
import pandas as pd
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s - %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)


def backtest_on_race(race_config, primary_xgb_model, primary_rf_model, primary_feature_cols):
    """
    Test pre-trained models on a new race.
    
    Args:
        race_config: Dict with year, event, session
        primary_xgb_model: Trained XGBoost model
        primary_rf_model: Trained Random Forest model
        primary_feature_cols: Feature column names from primary training
        
    Returns:
        Dict with backtesting results
    """
    
    from data.loader import load_race, get_race_results
    from data.cleaner import clean_laps
    from ml.features import engineer_features, prepare_train_test
    from sklearn.preprocessing import StandardScaler
    from config import STANDARDIZE_FEATURES
    
    race_name = f"{race_config['year']} {race_config['event']}"
    logger.info(f"\nBacktesting on {race_name}...")
    
    try:
        # Load and clean
        session, raw_laps, stats = load_race(**race_config)
        clean = clean_laps(raw_laps)
        results = get_race_results(session)
        
        # Feature engineering
        feat_df, feat_cols = engineer_features(clean, results)
        
        # Prepare test data (use all laps as test)
        feat_df = feat_df.sort_values(["Driver", "LapNumber"]).reset_index(drop=True)
        feat_df = feat_df[feat_df["LapTime_sec"].notna()]
        
        X = feat_df[primary_feature_cols].values
        y = feat_df["LapTime_sec"].values
        
        # Standardize
        if STANDARDIZE_FEATURES:
            scaler = StandardScaler()
            X = scaler.fit_transform(X)
        
        # Predict
        xgb_pred = primary_xgb_model.predict(X)
        rf_pred = primary_rf_model.predict(X)
        
        # Evaluate
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
        import numpy as np
        
        xgb_mae = mean_absolute_error(y, xgb_pred)
        xgb_rmse = np.sqrt(mean_squared_error(y, xgb_pred))
        xgb_r2 = r2_score(y, xgb_pred)
        
        rf_mae = mean_absolute_error(y, rf_pred)
        rf_rmse = np.sqrt(mean_squared_error(y, rf_pred))
        rf_r2 = r2_score(y, rf_pred)
        
        result = {
            "Race": race_name,
            "Laps": len(feat_df),
            "Drivers": stats["num_drivers"],
            "XGB_MAE": xgb_mae,
            "XGB_RMSE": xgb_rmse,
            "XGB_R2": xgb_r2,
            "RF_MAE": rf_mae,
            "RF_RMSE": rf_rmse,
            "RF_R2": rf_r2,
        }
        
        logger.info(f"✓ {race_name}")
        logger.info(f"  XGBoost: MAE={xgb_mae:.4f}, RMSE={xgb_rmse:.4f}, R²={xgb_r2:.4f}")
        logger.info(f"  RF:      MAE={rf_mae:.4f}, RMSE={rf_rmse:.4f}, R²={rf_r2:.4f}")
        
        return result
    
    except Exception as e:
        logger.error(f"✗ {race_name}: {e}")
        return None


def main():
    """Run backtesting."""
    
    print("\n" + "=" * 80)
    print("APEX26 BACKTESTING".center(80))
    print("=" * 80)
    
    from config import PRIMARY_RACE, BACKTESTING_RACES
    from data.loader import load_race, get_race_results
    from data.cleaner import clean_laps
    from ml.features import engineer_features, prepare_train_test
    from ml.models import train_models
    
    # ========================================================================
    # TRAIN ON PRIMARY RACE
    # ========================================================================
    
    print("\n" + "-" * 80)
    print("STEP 1: TRAIN ON PRIMARY RACE".center(80))
    print("-" * 80)
    
    logger.info(f"Training on primary race: {PRIMARY_RACE['year']} {PRIMARY_RACE['event']}")
    
    session, raw_laps, stats = load_race(**PRIMARY_RACE)
    clean = clean_laps(raw_laps)
    results = get_race_results(session)
    feat_df, feat_cols = engineer_features(clean, results)
    X_train, X_test, y_train, y_test, cols = prepare_train_test(feat_df, feat_cols)
    
    xgb_model, rf_model = train_models(X_train, X_test, y_train, y_test, cols)
    
    print(f"\n✓ Training complete")
    print(f"  XGBoost MAE: {xgb_model.metrics['MAE']:.4f}s")
    print(f"  RF MAE:      {rf_model.metrics['MAE']:.4f}s")
    
    # ========================================================================
    # BACKTEST ON ADDITIONAL RACES
    # ========================================================================
    
    print("\n" + "-" * 80)
    print("STEP 2: BACKTEST ON ADDITIONAL RACES".center(80))
    print("-" * 80)
    
    backtest_results = []
    
    for race_config in BACKTESTING_RACES:
        result = backtest_on_race(race_config, xgb_model, rf_model, cols)
        if result:
            backtest_results.append(result)
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    
    print("\n" + "=" * 80)
    print("BACKTESTING SUMMARY".center(80))
    print("=" * 80)
    
    if backtest_results:
        results_df = pd.DataFrame(backtest_results)
        
        print("\n" + results_df.to_string(index=False))
        
        # Aggregate stats
        print("\n" + "-" * 80)
        print("Aggregate Statistics:")
        print("-" * 80)
        
        xgb_mae_mean = results_df["XGB_MAE"].mean()
        xgb_mae_std = results_df["XGB_MAE"].std()
        
        rf_mae_mean = results_df["RF_MAE"].mean()
        rf_mae_std = results_df["RF_MAE"].std()
        
        print(f"\nXGBoost across all races:")
        print(f"  MAE:  {xgb_mae_mean:.4f}s ± {xgb_mae_std:.4f}s")
        print(f"  RMSE: {results_df['XGB_RMSE'].mean():.4f}s")
        print(f"  R²:   {results_df['XGB_R2'].mean():.4f}")
        
        print(f"\nRandom Forest across all races:")
        print(f"  MAE:  {rf_mae_mean:.4f}s ± {rf_mae_std:.4f}s")
        print(f"  RMSE: {results_df['RF_RMSE'].mean():.4f}s")
        print(f"  R²:   {results_df['RF_R2'].mean():.4f}")
        
        # Determine better model
        if xgb_mae_mean < rf_mae_mean:
            print(f"\n✓ XGBoost is better overall (MAE: {xgb_mae_mean:.4f}s vs {rf_mae_mean:.4f}s)")
        else:
            print(f"\n✓ Random Forest is better overall (MAE: {rf_mae_mean:.4f}s vs {xgb_mae_mean:.4f}s)")
        
        # Consistency check
        print(f"\nModel Consistency:")
        print(f"  XGBoost MAE std: {xgb_mae_std:.4f}s (lower = more consistent)")
        print(f"  RF MAE std:      {rf_mae_std:.4f}s")
        
        # Save results
        results_csv = Path(__file__).parent / "results" / "backtest_results.csv"
        results_csv.parent.mkdir(parents=True, exist_ok=True)
        results_df.to_csv(results_csv, index=False)
        print(f"\n✓ Results saved to {results_csv}")
    
    else:
        print("\n❌ No successful backtests")
    
    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()

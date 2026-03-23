"""
Machine learning models for lap time prediction.
Trains XGBoost and Random Forest, evaluates on test set, extracts feature importance.
"""

import logging
import pickle
from pathlib import Path
from typing import Tuple, Dict, List, Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.config import XGBOOST_PARAMS, RANDOM_FOREST_PARAMS, DEBUG_MODE
MODELS_DIR = Path(__file__).parent.parent.parent.parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)


class LapTimePredictor:
    """Base class for lap time prediction models."""
    
    def __init__(self, name: str):
        self.name = name
        self.model = None
        self.feature_names = None
        self.metrics = {}
    
    def train(self, X_train: np.ndarray, y_train: np.ndarray, feature_names: List[str]):
        """Train the model."""
        raise NotImplementedError
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict lap times."""
        if self.model is None:
            raise ValueError("Model not trained")
        return self.model.predict(X)
    
    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, float]:
        """Evaluate model on test set."""
        y_pred = self.predict(X_test)
        
        self.metrics = {
            "MAE": mean_absolute_error(y_test, y_pred),
            "RMSE": np.sqrt(mean_squared_error(y_test, y_pred)),
            "R2": r2_score(y_test, y_pred),
        }
        
        return self.metrics
    
    def get_feature_importance(self, top_n: int = 10) -> pd.DataFrame:
        """Extract feature importance."""
        raise NotImplementedError
    
    def save(self, path: Path = None):
        """Save model to disk."""
        if path is None:
            path = MODELS_DIR / f"{self.name}.pkl"
        
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, "wb") as f:
            pickle.dump(self, f)
        
        logger.info(f"✓ Model saved: {path}")
    
    @staticmethod
    def load(name: str, path: Path = None):
        """Load model from disk."""
        if path is None:
            path = MODELS_DIR / f"{name}.pkl"
        
        with open(path, "rb") as f:
            model = pickle.load(f)
        
        logger.info(f"✓ Model loaded: {path}")
        return model


class XGBoostPredictor(LapTimePredictor):
    """XGBoost model for lap time prediction."""
    
    def __init__(self):
        super().__init__("xgboost")
        self.model = None
    
    def train(self, X_train: np.ndarray, y_train: np.ndarray, feature_names: List[str]):
        """Train XGBoost model."""
        logger.info(f"Training XGBoost with {len(X_train)} samples...")
        
        self.feature_names = feature_names
        
        self.model = xgb.XGBRegressor(
            **XGBOOST_PARAMS,
            eval_metric="mae",
        )
        
        self.model.fit(
            X_train, y_train,
            verbose=0,
        )
        
        logger.info("✓ XGBoost training complete")
    
    def get_feature_importance(self, top_n: int = 10) -> pd.DataFrame:
        """Extract XGBoost feature importance (impurity-based)."""
        if self.model is None:
            raise ValueError("Model not trained")
        
        importance = self.model.feature_importances_
        
        feat_imp = pd.DataFrame({
            "Feature": self.feature_names,
            "Importance": importance,
        }).sort_values("Importance", ascending=False)
        
        return feat_imp.head(top_n)


class RandomForestPredictor(LapTimePredictor):
    """Random Forest model for lap time prediction."""
    
    def __init__(self):
        super().__init__("random_forest")
        self.model = None
    
    def train(self, X_train: np.ndarray, y_train: np.ndarray, feature_names: List[str]):
        """Train Random Forest model."""
        logger.info(f"Training Random Forest with {len(X_train)} samples...")
        
        self.feature_names = feature_names
        
        self.model = RandomForestRegressor(
            **RANDOM_FOREST_PARAMS,
        )
        
        self.model.fit(X_train, y_train)
        
        logger.info("✓ Random Forest training complete")
    
    def get_feature_importance(self, top_n: int = 10) -> pd.DataFrame:
        """Extract Random Forest feature importance (MDI)."""
        if self.model is None:
            raise ValueError("Model not trained")
        
        importance = self.model.feature_importances_
        
        feat_imp = pd.DataFrame({
            "Feature": self.feature_names,
            "Importance": importance,
        }).sort_values("Importance", ascending=False)
        
        return feat_imp.head(top_n)


def train_models(
    X_train: np.ndarray,
    X_test: np.ndarray,
    y_train: np.ndarray,
    y_test: np.ndarray,
    feature_names: List[str],
) -> Tuple[XGBoostPredictor, RandomForestPredictor]:
    """
    Train both XGBoost and Random Forest models.
    
    Args:
        X_train, X_test, y_train, y_test: Train/test data
        feature_names: Feature column names
        
    Returns:
        Tuple of (xgb_model, rf_model)
    """
    
    logger.info("=" * 60)
    logger.info("TRAINING MODELS")
    logger.info("=" * 60)
    
    # XGBoost
    xgb_model = XGBoostPredictor()
    xgb_model.train(X_train, y_train, feature_names)
    xgb_metrics = xgb_model.evaluate(X_test, y_test)
    logger.info(f"XGBoost metrics: MAE={xgb_metrics['MAE']:.4f}, RMSE={xgb_metrics['RMSE']:.4f}, R²={xgb_metrics['R2']:.4f}")
    
    # Random Forest
    rf_model = RandomForestPredictor()
    rf_model.train(X_train, y_train, feature_names)
    rf_metrics = rf_model.evaluate(X_test, y_test)
    logger.info(f"Random Forest metrics: MAE={rf_metrics['MAE']:.4f}, RMSE={rf_metrics['RMSE']:.4f}, R²={rf_metrics['R2']:.4f}")
    
    logger.info("=" * 60)
    
    # Compare models
    logger.info("\nModel Comparison:")
    logger.info(f"XGBoost MAE:  {xgb_metrics['MAE']:.4f}")
    logger.info(f"RF MAE:       {rf_metrics['MAE']:.4f}")
    better = "XGBoost" if xgb_metrics['MAE'] < rf_metrics['MAE'] else "Random Forest"
    logger.info(f"Better model (by MAE): {better}")
    
    return xgb_model, rf_model


def compare_feature_importance(
    xgb_model: XGBoostPredictor,
    rf_model: RandomForestPredictor,
    top_n: int = 10,
) -> pd.DataFrame:
    """
    Compare feature importance between models.
    
    Args:
        xgb_model: Trained XGBoost model
        rf_model: Trained Random Forest model
        top_n: Top N features to display
        
    Returns:
        DataFrame with importance comparison
    """
    
    xgb_imp = xgb_model.get_feature_importance(top_n=top_n)
    rf_imp = rf_model.get_feature_importance(top_n=top_n)
    
    # Merge and compare
    comparison = xgb_imp.rename(columns={"Importance": "XGBoost"}).set_index("Feature")
    rf_comparison = rf_imp.set_index("Feature")
    
    comparison = comparison.join(rf_comparison.rename(columns={"Importance": "RF"}), how="outer")
    comparison = comparison.fillna(0).sort_values("XGBoost", ascending=False)
    
    logger.info("\nFeature Importance Comparison (Top 10):")
    logger.info(comparison.head(10).to_string())
    
    return comparison.head(top_n)


if __name__ == "__main__":
    # Example usage
    import sys
    logging.basicConfig(level=logging.INFO)
    
    from ml.features import engineer_features, prepare_train_test
    from data.loader import load_race, get_race_results
    from data.cleaner import clean_laps
    from config import PRIMARY_RACE
    
    print("\n" + "=" * 60)
    print("APEX26 ML PIPELINE")
    print("=" * 60)
    
    print("\nLoading race data...")
    session, raw_laps, stats = load_race(**PRIMARY_RACE)
    
    print("Cleaning laps...")
    clean = clean_laps(raw_laps)
    
    print("\nEngineering features...")
    results = get_race_results(session)
    feat_df, feat_cols = engineer_features(clean, results)
    
    print("\nPreparing train/test...")
    X_train, X_test, y_train, y_test, cols = prepare_train_test(feat_df, feat_cols)
    
    print("\nTraining models...")
    xgb_model, rf_model = train_models(X_train, X_test, y_train, y_test, cols)
    
    print("\nComparing feature importance...")
    comparison = compare_feature_importance(xgb_model, rf_model, top_n=10)
    
    print("\nSaving models...")
    xgb_model.save()
    rf_model.save()
    
    print("\n✓ ML pipeline complete!")

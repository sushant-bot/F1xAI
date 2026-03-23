"""
Apex26 Streamlit Dashboard - Main Entrypoint
Initializes session state, loads data, and sets up multi-page navigation.
"""

import logging
import streamlit as st
from pathlib import Path
import sys

# Ensure project root is importable when running `streamlit run ui/app.py`.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Configure page
st.set_page_config(
    page_title="Apex26: F1 Race Strategy Simulator",
    page_icon="🏎️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Custom CSS
st.markdown("""
<style>
    .main {
        padding: 1rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
    }
</style>
""", unsafe_allow_html=True)


# ============================================================================
# SESSION STATE INITIALIZATION
# ============================================================================

def init_session_state():
    """Initialize Streamlit session state with default values."""
    
    if "data_loaded" not in st.session_state:
        st.session_state.data_loaded = False
        st.session_state.session = None
        st.session_state.session_stats = None
        st.session_state.clean_laps = None
        st.session_state.race_results = None
        st.session_state.pit_strategies = None
        st.session_state.feature_df = None
        st.session_state.feature_cols = None
        st.session_state.xgb_model = None
        st.session_state.rf_model = None
    
    if "selected_race" not in st.session_state:
        st.session_state.selected_race = "Bahrain 2023"
    
    if "selected_drivers" not in st.session_state:
        st.session_state.selected_drivers = None
    
    if "selected_driver_detail" not in st.session_state:
        st.session_state.selected_driver_detail = None


init_session_state()


# ============================================================================
# DATA LOADING (CACHED)
# ============================================================================

@st.cache_data
def load_race_data():
    """Load race data from FastF1 (cached to avoid repeated API calls)."""
    from config import PRIMARY_RACE
    from data.loader import load_race, get_race_results, get_pit_strategies
    from data.cleaner import clean_laps
    from ml.features import engineer_features, prepare_train_test
    from ml.models import train_models
    
    logger.info("Loading race data from FastF1...")
    
    try:
        # Load session
        session, raw_laps, stats = load_race(**PRIMARY_RACE)
        
        # Clean laps
        clean = clean_laps(raw_laps)
        
        # Get pit strategies and results
        results = get_race_results(session)
        pit_strats = get_pit_strategies(session)
        
        # Feature engineering
        feat_df, feat_cols = engineer_features(clean, results)
        
        # Prepare train/test
        X_train, X_test, y_train, y_test, cols = prepare_train_test(feat_df, feat_cols)
        
        # Train models
        xgb_model, rf_model = train_models(X_train, X_test, y_train, y_test, cols)
        
        return {
            "session": session,
            "stats": stats,
            "clean_laps": clean,
            "results": results,
            "pit_strategies": pit_strats,
            "feature_df": feat_df,
            "feature_cols": feat_cols,
            "xgb_model": xgb_model,
            "rf_model": rf_model,
        }
    
    except Exception as e:
        logger.error(f"Failed to load race data: {e}")
        st.error(f"Failed to load race data: {e}")
        return None


# ============================================================================
# PAGE SETUP
# ============================================================================

def main():
    """Main app with multi-page navigation."""
    
    # Sidebar title
    st.sidebar.title("🏎️ Apex26")
    st.sidebar.markdown("---")
    
    # Load data on first run
    if not st.session_state.data_loaded:
        with st.spinner("Loading race data from FastF1..."):
            data = load_race_data()
            if data:
                st.session_state.session = data["session"]
                st.session_state.session_stats = data["stats"]
                st.session_state.clean_laps = data["clean_laps"]
                st.session_state.race_results = data["results"]
                st.session_state.pit_strategies = data["pit_strategies"]
                st.session_state.feature_df = data["feature_df"]
                st.session_state.feature_cols = data["feature_cols"]
                st.session_state.xgb_model = data["xgb_model"]
                st.session_state.rf_model = data["rf_model"]
                st.session_state.data_loaded = True
                st.success("✓ Data loaded successfully!")
            else:
                st.error("Failed to load data. Please check logs.")
                return
    
    # Page navigation
    st.sidebar.markdown("**Navigation**")
    pages = {
        "🏁 Overview": "overview",
        "📊 Detailed Analysis": "analysis",
        "🎯 Predictions & Strategy": "predictions",
    }
    
    page = st.sidebar.radio("Select page", options=list(pages.keys()))
    page_key = pages[page]
    
    # Route to page
    if page_key == "overview":
        from pages import page_overview
        page_overview.show()
    elif page_key == "analysis":
        from pages import page_analysis
        page_analysis.show()
    elif page_key == "predictions":
        from pages import page_predictions
        page_predictions.show()
    
    # Sidebar info
    st.sidebar.markdown("---")
    st.sidebar.markdown("**Race Info**")
    if st.session_state.session_stats:
        stats = st.session_state.session_stats
        st.sidebar.metric("Race", f"{stats['year']} {stats['event']}")
        st.sidebar.metric("Drivers", stats["num_drivers"])
        st.sidebar.metric("Total Laps", stats["total_laps"])
        st.sidebar.metric("Pit Stops", stats["num_pit_stops"])
    
    st.sidebar.markdown("---")
    st.sidebar.markdown("**About**")
    st.sidebar.info(
        """
        **Apex26** is a full-stack F1 strategy simulation platform.
        
        - **Data**: FastF1 real telemetry
        - **Models**: XGBoost + Random Forest lap time prediction
        - **Simulation**: Energy deployment + pit strategy optimization
        - **Dashboard**: Interactive what-if analysis
        
        [GitHub](https://github.com/yourusername/apex26) | [Documentation](README.md)
        """
    )


if __name__ == "__main__":
    main()

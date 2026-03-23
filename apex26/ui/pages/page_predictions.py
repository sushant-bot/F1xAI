"""
Apex26 Predictions & Strategy Page
What-if scenarios, model predictions, feature importance, and energy simulation.
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go


def _ensure_session_state_defaults() -> None:
    """Ensure required session-state keys exist when page is run directly."""
    defaults = {
        "feature_df": None,
        "xgb_model": None,
        "rf_model": None,
        "clean_laps": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


@st.cache_data
def get_cached_feature_importance(model_name: str):
    """Get and cache feature importance from trained model."""
    if model_name == "xgboost":
        model = st.session_state.xgb_model
    else:
        model = st.session_state.rf_model
    
    return model.get_feature_importance(top_n=10)


def show():
    """Render predictions and strategy page."""
    _ensure_session_state_defaults()
    
    st.title("🎯 Predictions & Strategy")
    st.markdown("Interactive what-if scenarios, model predictions, and energy strategy simulation.")
    
    # Get data from session state
    feature_df = st.session_state.get("feature_df")
    xgb_model = st.session_state.get("xgb_model")
    rf_model = st.session_state.get("rf_model")
    clean_laps = st.session_state.get("clean_laps")
    
    if not all([feature_df is not None, xgb_model is not None, rf_model is not None]):
        st.error("Models not trained. Please check the main app.")
        return
    
    # ========================================================================
    # DRIVER SELECTION
    # ========================================================================
    
    st.markdown("### 👤 Select Driver & Parameters")
    
    driver_list = sorted(clean_laps["Driver"].unique())
    selected_driver = st.selectbox(
        "Choose a driver",
        driver_list,
        key="pred_driver_select"
    )
    
    driver_laps = clean_laps[clean_laps["Driver"] == selected_driver].copy()
    driver_laps["LapTime_sec"] = driver_laps["LapTime"].dt.total_seconds()
    
    # ========================================================================
    # WHAT-IF SLIDERS
    # ========================================================================
    
    st.markdown("### ⚙️ What-If Scenario Parameters")
    
    col1, col2 = st.columns(2)
    
    with col1:
        pit_lap_default = int(len(driver_laps) * 0.5)  # Default: mid-race
        pit_lap = st.slider(
            "Pit Lap Override",
            min_value=1,
            max_value=len(driver_laps),
            value=pit_lap_default,
            help="Lap number to pit if different from recommended",
            key="pit_lap_slider"
        )
    
    with col2:
        energy_mode = st.selectbox(
            "Energy Mode Strategy",
            ["Neutral (default)", "Conservative (save energy)", "Aggressive (push early)"],
            key="energy_mode_select"
        )
    
    # ========================================================================
    # SCENARIO SIMULATION
    # ========================================================================
    
    st.markdown("### 🔬 Simulated Race Results")
    
    # Import simulation modules
    from sim.energy import EnergySimulator
    from sim.strategy import StrategyEngine
    
    # Prepare data for simulation
    feat_df_driver = feature_df[feature_df["Driver"] == selected_driver].copy()
    feat_df_driver = feat_df_driver.sort_values("LapNumber")
    
    if len(feat_df_driver) > 0:
        # Create energy simulator
        sim = EnergySimulator()
        
        # Define strategy based on selected mode
        race_length = len(feat_df_driver)
        if energy_mode == "Conservative (save energy)":
            strategy = [
                (1, pit_lap, "conserve"),
                (pit_lap + 1, race_length, "neutral"),
            ]
        elif energy_mode == "Aggressive (push early)":
            strategy = [
                (1, pit_lap, "boost"),
                (pit_lap + 1, race_length, "neutral"),
            ]
        else:  # Neutral
            strategy = [
                (1, pit_lap - 1, "neutral"),
                (pit_lap, race_length, "boost"),
            ]
        
        # Run simulation
        simulated_df = sim.simulate_race(feat_df_driver, strategy)
        
        # Display results
        col1, col2, col3 = st.columns(3)
        
        total_actual_time = feat_df_driver["LapTime_sec"].sum()
        total_simulated_time = simulated_df["SimulatedLapTime"].sum()
        time_delta = total_simulated_time - total_actual_time
        
        with col1:
            st.metric(
                "Actual Race Time",
                f"{total_actual_time:.1f}s",
            )
        
        with col2:
            st.metric(
                "Simulated Race Time",
                f"{total_simulated_time:.1f}s",
            )
        
        with col3:
            st.metric(
                "Time Delta",
                f"{time_delta:+.1f}s",
                delta=f"{time_delta:+.1f}s",
            )
        
        # Plot actual vs simulated paces
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=feat_df_driver["LapNumber"],
            y=feat_df_driver["LapTime_sec"],
            mode="lines",
            name="Actual",
            line=dict(color="blue", width=2),
        ))
        
        fig.add_trace(go.Scatter(
            x=simulated_df["LapNumber"],
            y=simulated_df["SimulatedLapTime"],
            mode="lines",
            name="Simulated",
            line=dict(color="red", width=2, dash="dash"),
        ))
        
        fig.update_layout(
            title="Actual vs Simulated Lap Times",
            xaxis_title="Lap Number",
            yaxis_title="Lap Time (seconds)",
            hovermode="x unified",
            height=400,
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        # ====================================================================
        # ENERGY MODE VISUALIZATION
        # ====================================================================
        
        st.markdown("### ⚡ Energy State Over Race")
        
        fig = go.Figure()
        
        # Energy state
        fig.add_trace(go.Scatter(
            x=simulated_df["LapNumber"],
            y=simulated_df["EnergyState"],
            mode="lines",
            name="Energy State",
            line=dict(color="green", width=2),
            fill="tozeroy",
        ))
        
        fig.update_layout(
            title="Energy State Over Race",
            xaxis_title="Lap Number",
            yaxis_title="Energy Points",
            height=350,
        )
        
        st.plotly_chart(fig, use_container_width=True)
    
    else:
        st.warning("Not enough data to simulate race.")
    
    # ========================================================================
    # MODEL SELECTION & FEATURE IMPORTANCE
    # ========================================================================
    
    st.markdown("### 📊 Feature Importance")
    
    model_choice = st.radio(
        "Select model",
        ["XGBoost", "Random Forest"],
        key="model_choice"
    )
    
    # Get feature importance
    if model_choice == "XGBoost":
        feat_imp = get_cached_feature_importance("xgboost")
    else:
        feat_imp = get_cached_feature_importance("random_forest")
    
    # Plot feature importance
    fig = px.bar(
        feat_imp,
        x="Importance",
        y="Feature",
        orientation="h",
        title=f"{model_choice} - Top 10 Feature Importance",
        labels={"Importance": "Importance Score", "Feature": "Feature"},
    )
    
    fig.update_layout(
        height=400,
        yaxis_categoryorder="total ascending",
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    # ========================================================================
    # MODEL METRICS
    # ========================================================================
    
    st.markdown("### 📈 Model Performance Metrics")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric(
            f"{model_choice} - MAE (Mean Absolute Error)",
            f"{xgb_model.metrics['MAE'] if model_choice == 'XGBoost' else rf_model.metrics['MAE']:.4f}s",
            help="Lower is better. Average error in lap time prediction.",
        )
    
    with col2:
        st.metric(
            f"{model_choice} - RMSE (Root Mean Squared Error)",
            f"{xgb_model.metrics['RMSE'] if model_choice == 'XGBoost' else rf_model.metrics['RMSE']:.4f}s",
            help="Lower is better. Penalizes large errors.",
        )
    
    with col3:
        st.metric(
            f"{model_choice} - R² (Coefficient of Determination)",
            f"{xgb_model.metrics['R2'] if model_choice == 'XGBoost' else rf_model.metrics['R2']:.4f}",
            help="Higher is better. 1.0 = perfect, 0.5 = good.",
        )
    
    # ========================================================================
    # STRATEGY RECOMMENDATIONS
    # ========================================================================
    
    st.markdown("### 💡 Strategy Recommendations")
    
    strategy_engine = StrategyEngine()
    
    # Get pit recommendation
    pit_recs = strategy_engine.recommend_pit_lap(driver_laps, selected_driver)
    
    st.info(strategy_engine.get_pit_strategy_string(pit_recs))


if __name__ == "__main__":
    show()


# Helper class for strategy engine (inline for now, can be imported)
class StrategyEngine:
    """Simplified strategy engine (uses rule-based logic)."""
    
    def recommend_pit_lap(self, driver_laps, driver):
        """Recommend pit lap based on tire degradation."""
        
        recommendations = []
        
        for stint_num, stint_data in driver_laps.groupby("Stint"):
            stint_data = stint_data.sort_values("TyreLife")
            
            if len(stint_data) < 3:
                continue
            
            lap_times = stint_data["LapTime"].dt.total_seconds().values
            lap_nums = stint_data["LapNumber"].astype(int).values
            compound = stint_data["Compound"].iloc[0]
            
            time_spread = lap_times.max() - lap_times.min()
            
            if time_spread > 0.5 and len(lap_times) > 5:
                pit_idx = int(len(lap_nums) * 0.7)
                pit_lap = lap_nums[pit_idx] if pit_idx < len(lap_nums) else lap_nums[-1]
                
                recommendations.append({
                    "Stint": stint_num,
                    "Compound": compound,
                    "LapCount": len(lap_nums),
                    "RecommendedPitLap": pit_lap,
                    "Reason": f"Degradation {time_spread:.2f}s over {len(lap_nums)} laps",
                })
        
        if not recommendations:
            recommendations = [{
                "Stint": 1,
                "Compound": "Unknown",
                "LapCount": 0,
                "RecommendedPitLap": 26,
                "Reason": "Default pit window",
            }]
        
        return {
            "Driver": driver,
            "PitRecommendations": recommendations,
        }
    
    def get_pit_strategy_string(self, pit_recs):
        """Format pit recommendations as string."""
        driver = pit_recs["Driver"]
        recs = pit_recs["PitRecommendations"]
        
        lines = [f"**Pit Strategy for {driver}:**"]
        
        for i, rec in enumerate(recs, 1):
            lines.append(f"\n**Stint {i}** ({rec['Compound']})")
            lines.append(f"- Laps: {rec['LapCount']}")
            lines.append(f"- Recommended pit lap: **{rec['RecommendedPitLap']}**")
            lines.append(f"- Reason: {rec['Reason']}")
        
        return "\n".join(lines)

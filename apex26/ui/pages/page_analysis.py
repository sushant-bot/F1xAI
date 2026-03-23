"""
Apex26 Detailed Analysis Page
Driver-specific analysis: degradation curves, sector trends, pit history.
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def show():
    """Render detailed analysis page."""
    
    st.title("📊 Detailed Analysis")
    st.markdown("Deep dive into individual driver performance, tire degradation, and strategy.")
    
    # Get data from session state
    clean_laps = st.session_state.clean_laps
    pit_strategies = st.session_state.pit_strategies
    
    if clean_laps is None:
        st.error("No data loaded. Please check the main app.")
        return
    
    # ========================================================================
    # DRIVER SELECTION
    # ========================================================================
    
    st.markdown("### 👤 Select Driver")
    
    driver_list = sorted(clean_laps["Driver"].unique())
    selected_driver = st.selectbox(
        "Choose a driver",
        driver_list,
        key="driver_select"
    )
    
    # Filter data for selected driver
    driver_laps = clean_laps[clean_laps["Driver"] == selected_driver].copy()
    driver_laps["LapTime_sec"] = driver_laps["LapTime"].dt.total_seconds()
    
    if len(driver_laps) == 0:
        st.error(f"No data for driver {selected_driver}")
        return
    
    # ========================================================================
    # DRIVER STATS
    # ========================================================================
    
    st.markdown(f"### 📈 {selected_driver} Performance Stats")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "Total Laps",
            len(driver_laps)
        )
    
    with col2:
        best_lap = driver_laps["LapTime_sec"].min()
        st.metric(
            "Best Lap",
            f"{best_lap:.2f}s"
        )
    
    with col3:
        avg_lap = driver_laps["LapTime_sec"].mean()
        st.metric(
            "Avg Lap",
            f"{avg_lap:.2f}s"
        )
    
    with col4:
        pit_count = len(driver_laps[driver_laps["PitInTime"].notna()])
        st.metric(
            "Pit Stops",
            pit_count
        )
    
    # ========================================================================
    # LAP TIME PROGRESSION
    # ========================================================================
    
    st.markdown("### 📉 Lap Time Progression")
    
    fig = go.Figure()
    
    # Add lap time line
    fig.add_trace(go.Scatter(
        x=driver_laps["LapNumber"],
        y=driver_laps["LapTime_sec"],
        mode="lines+markers",
        name="Lap Time",
        line=dict(color="blue", width=2),
    ))
    
    # Add 5-lap rolling average
    rolling_avg = driver_laps["LapTime_sec"].rolling(window=5, center=True).mean()
    fig.add_trace(go.Scatter(
        x=driver_laps["LapNumber"],
        y=rolling_avg,
        mode="lines",
        name="5-Lap Average",
        line=dict(color="red", width=2, dash="dash"),
    ))
    
    fig.update_layout(
        title=f"{selected_driver} Lap Time Progression",
        xaxis_title="Lap Number",
        yaxis_title="Lap Time (seconds)",
        hovermode="x unified",
        height=500,
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    # ========================================================================
    # TIRE DEGRADATION CURVES
    # ========================================================================
    
    st.markdown("### 🛞 Tire Degradation Curves")
    
    # Group by compound
    compounds = driver_laps["Compound"].unique()
    
    fig = go.Figure()
    
    for compound in compounds:
        compound_laps = driver_laps[driver_laps["Compound"] == compound].sort_values("TyreLife")
        
        if len(compound_laps) > 1:
            fig.add_trace(go.Scatter(
                x=compound_laps["TyreLife"],
                y=compound_laps["LapTime_sec"],
                mode="lines+markers",
                name=f"{compound}",
            ))
    
    fig.update_layout(
        title=f"{selected_driver} Tire Degradation by Compound",
        xaxis_title="Tire Age (laps)",
        yaxis_title="Lap Time (seconds)",
        hovermode="x unified",
        height=400,
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    # ========================================================================
    # POSITION OVER TIME
    # ========================================================================
    
    st.markdown("### 📍 Position Progression")
    
    fig = px.line(
        driver_laps,
        x="LapNumber",
        y="Position",
        markers=True,
        title=f"{selected_driver} Position Over Race",
        labels={"Position": "Grid Position", "LapNumber": "Lap"},
    )
    
    fig.update_layout(
        yaxis_autorange="reversed",  # Invert Y axis so position 1 is at top
        height=400,
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    # ========================================================================
    # PIT HISTORY TABLE
    # ========================================================================
    
    st.markdown("### 🏁 Pit History & Stints")
    
    # Build stint summary
    stints = []
    for stint_num in driver_laps["Stint"].unique():
        stint_data = driver_laps[driver_laps["Stint"] == stint_num]
        
        if len(stint_data) > 0:
            stints.append({
                "Stint": int(stint_num),
                "Compound": stint_data["Compound"].iloc[0],
                "Laps": len(stint_data),
                "FirstLap": int(stint_data["LapNumber"].min()),
                "LastLap": int(stint_data["LapNumber"].max()),
                "AvgTime": f"{stint_data['LapTime_sec'].mean():.2f}s",
                "BestTime": f"{stint_data['LapTime_sec'].min():.2f}s",
            })
    
    if stints:
        stint_df = pd.DataFrame(stints)
        st.dataframe(stint_df, use_container_width=True)
    else:
        st.info("No stint data available.")
    
    # ========================================================================
    # COMPOUND COMPARISON
    # ========================================================================
    
    st.markdown("### ⚖️ Compound Comparison")
    
    compound_stats = driver_laps.groupby("Compound").agg({
        "LapTime_sec": ["count", "mean", "min", "max", "std"],
    }).round(2)
    
    compound_stats.columns = ["LapCount", "AvgTime", "BestTime", "WorstTime", "StdDev"]
    
    st.dataframe(compound_stats, use_container_width=True)


if __name__ == "__main__":
    show()

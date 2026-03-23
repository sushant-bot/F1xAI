"""
Apex26 Overview Page
Displays race facts, results table, lap-time chart, and KPI cards.
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def show():
    """Render overview page."""
    
    st.title("🏁 Race Overview")
    st.markdown("High-level summary of race results, lap times, and key metrics.")
    
    # Get data from session state
    stats = st.session_state.session_stats
    clean_laps = st.session_state.clean_laps
    race_results = st.session_state.race_results
    pit_strategies = st.session_state.pit_strategies
    
    if not all([stats, clean_laps is not None, race_results is not None]):
        st.error("No data loaded. Please check the main app.")
        return
    
    # ========================================================================
    # KPI CARDS
    # ========================================================================
    
    st.markdown("### 📈 Key Metrics")
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "Race",
            f"{stats['year']} {stats['event'].split('Grand Prix')[0].strip()}",
        )
    
    with col2:
        st.metric(
            "Drivers",
            stats["num_drivers"]
        )
    
    with col3:
        st.metric(
            "Total Laps",
            stats["total_laps"]
        )
    
    with col4:
        avg_lap = clean_laps["LapTime"].mean().total_seconds()
        st.metric(
            "Avg Lap Time",
            f"{avg_lap:.2f}s"
        )
    
    # ========================================================================
    # LAP TIME CHART
    # ========================================================================
    
    st.markdown("### 📊 Lap Times Over Race")
    
    # Prepare data for chart
    chart_data = clean_laps[["Driver", "LapNumber", "LapTime", "Compound"]].copy()
    chart_data["LapTime_sec"] = chart_data["LapTime"].dt.total_seconds()
    
    # Create line chart
    fig = px.line(
        chart_data,
        x="LapNumber",
        y="LapTime_sec",
        color="Driver",
        hover_data={"Compound": True, "LapTime_sec": ":.2f"},
        title="Lap Time Progression by Driver",
        labels={"LapTime_sec": "Lap Time (seconds)", "LapNumber": "Lap"},
    )
    
    fig.update_layout(
        hovermode="x unified",
        height=500,
        showlegend=True,
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    # ========================================================================
    # RACE RESULTS TABLE
    # ========================================================================
    
    st.markdown("### 🏆 Race Results")
    
    # Prepare results table
    results_display = race_results[["Driver", "GridPosition", "Position", "Status"]].copy()

    # Convert numeric columns, handling DNF/DNS cases
    results_display["Position"] = pd.to_numeric(results_display["Position"], errors="coerce")
    results_display["GridPosition"] = pd.to_numeric(results_display["GridPosition"], errors="coerce")

    # Sort by Position (NaN values will go to the end)
    results_display = results_display.sort_values("Position")
    results_display = results_display.reset_index(drop=True)
    results_display.index = results_display.index + 1
    
    st.dataframe(
        results_display,
        use_container_width=True,
        height=400,
    )
    
    # ========================================================================
    # PIT STRATEGIES
    # ========================================================================
    
    st.markdown("### 🏁 Pit Strategies")
    
    if not pit_strategies.empty:
        # Show pit strategy summary
        pit_summary = pit_strategies.groupby("Driver").agg({
            "Stint": "max",
            "Compound": lambda x: " → ".join(x.unique()),
        }).rename(columns={"Stint": "NumStints", "Compound": "Compounds"})
        
        st.dataframe(
            pit_summary.head(10),
            use_container_width=True,
        )
    else:
        st.info("No pit strategy data available.")
    
    # ========================================================================
    # TIRE COMPOUND BREAKDOWN
    # ========================================================================
    
    st.markdown("### 🛞 Tire Compounds Used")
    
    compound_counts = clean_laps["Compound"].value_counts()
    
    fig = px.pie(
        values=compound_counts.values,
        names=compound_counts.index,
        title="Lap Count by Tire Compound",
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    # ========================================================================
    # DRIVER PACE RANKING
    # ========================================================================
    
    st.markdown("### ⚡ Driver Pace Ranking (Best Lap Time)")
    
    best_laps = clean_laps.groupby("Driver")["LapTime"].min().reset_index()
    best_laps["LapTime_sec"] = best_laps["LapTime"].dt.total_seconds()
    best_laps = best_laps.sort_values("LapTime_sec").reset_index(drop=True)
    best_laps.index = best_laps.index + 1
    
    st.dataframe(
        best_laps[["Driver", "LapTime_sec"]].rename(columns={"LapTime_sec": "Best Lap (seconds)"}),
        use_container_width=True,
    )


if __name__ == "__main__":
    show()

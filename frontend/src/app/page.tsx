"use client";

import { useEffect, useRef, useState } from "react";
import { fetchOverviewRace, type RaceOverview } from "@/lib/api";
import TelemetryView from "@/components/TelemetryView";
import DriversView from "@/components/DriversView";
import StrategyView from "@/components/StrategyView";
import TyresView from "@/components/TyresView";
import GapAnalysisView from "@/components/GapAnalysisView";
import RaceReplayView from "@/components/RaceReplayView";
import StrategyRecommendationsView from "@/components/StrategyRecommendationsView";

export default function Home() {
  const [overview, setOverview] = useState<RaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("telemetry");
  const activeRequestRef = useRef<AbortController | null>(null);

  const loadOverview = async (manualRefresh = false) => {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    if (manualRefresh) {
      setRefreshing(true);
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchOverviewRace(2023, "Bahrain Grand Prix", "Race", {
        timeoutMs: 30000,
        signal: controller.signal,
      });
      setOverview(data);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setLoading(false);
        if (manualRefresh) {
          setRefreshing(false);
        }
      }
    }
  };

  useEffect(() => {
    loadOverview(false);
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);

  const handleRefresh = async () => {
    await loadOverview(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface">
        <div className="scanline" />
        <Header />
        <div className="flex flex-1 pt-20 pb-16 md:pb-0">
          <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} onRefresh={handleRefresh} isRefreshing={refreshing} />
          <main className="md:ml-48 flex-1 flex items-center justify-center grid-bg sub-pixel-grid p-4">
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 border-2 border-primary-container border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
              <div className="text-primary-container font-headline font-bold text-sm uppercase tracking-widest mb-2">
                [LOADING_DATA]
              </div>
              <div className="text-stone-500 text-xs font-mono">Connecting to FastF1 API...</div>
            </div>
          </main>
        </div>
        <MobileNav activeNav={activeNav} setActiveNav={setActiveNav} />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="flex flex-col min-h-screen bg-surface">
        <div className="scanline" />
        <Header />
        <div className="flex flex-1 pt-20 pb-16 md:pb-0">
          <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} onRefresh={handleRefresh} isRefreshing={refreshing} />
          <main className="md:ml-48 flex-1 flex items-center justify-center grid-bg sub-pixel-grid p-4">
            <div className="text-center bg-surface-container border border-stone-800 p-6 max-w-md instrument-border">
              <div className="text-primary-container font-headline font-bold text-sm uppercase tracking-widest mb-2">
                [CONNECTION_ERROR]
              </div>
              <div className="text-stone-400 text-xs font-mono mb-4">{error ?? "Unknown error"}</div>
              <div className="text-stone-600 text-[10px] font-mono mb-4">
                Ensure backend is running at http://localhost:8000
              </div>
              <button
                onClick={handleRefresh}
                className="bg-primary-container text-white font-headline font-bold text-[10px] px-4 py-2 tracking-widest uppercase hover:bg-red-700 transition-colors"
              >
                RETRY CONNECTION
              </button>
            </div>
          </main>
        </div>
        <MobileNav activeNav={activeNav} setActiveNav={setActiveNav} />
      </div>
    );
  }

  const renderView = () => {
    switch (activeNav) {
      case "telemetry":
        return <TelemetryView overview={overview} />;
      case "drivers":
        return <DriversView overview={overview} />;
      case "strategy":
        return <StrategyView overview={overview} />;
      case "tyres":
        return <TyresView overview={overview} />;
      case "gaps":
        return <GapAnalysisView overview={overview} />;
      case "replay":
        return <RaceReplayView overview={overview} />;
      case "recommendations":
        return <StrategyRecommendationsView overview={overview} />;
      default:
        return <TelemetryView overview={overview} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <div className="scanline" />
      <Header
        raceName={overview.metrics.race_name}
        trackName={overview.metrics.track_name}
        totalLaps={overview.metrics.total_laps}
        activeView={activeNav}
      />
      <div className="flex flex-1 pt-20 pb-16 md:pb-0">
        <Sidebar
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
        />
        <main className="md:ml-48 flex-1 flex flex-col grid-bg sub-pixel-grid p-4 overflow-auto">
          {renderView()}
        </main>
      </div>
      <MobileNav activeNav={activeNav} setActiveNav={setActiveNav} />
    </div>
  );
}

function Header({
  raceName,
  trackName,
  totalLaps,
  activeView,
}: {
  raceName?: string;
  trackName?: string;
  totalLaps?: number;
  activeView?: string;
}) {
  const getViewLabel = (view: string) => {
    const labels: Record<string, string> = {
      telemetry: "TELEMETRY",
      drivers: "DRIVERS",
      strategy: "STRATEGY",
      tyres: "TYRES",
      gaps: "GAP ANALYSIS",
      replay: "RACE REPLAY",
      recommendations: "STRATEGY AI",
    };
    return labels[view] || "TELEMETRY";
  };

  return (
    <header className="bg-surface border-b border-stone-800 flex flex-col w-full z-50 fixed top-0">
      <div className="flex justify-between items-center h-12 px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black uppercase tracking-tighter text-primary-container font-headline">
            APEX26
          </span>
          <span className="hidden sm:inline text-[10px] font-mono text-stone-600 px-2 border-x border-stone-800">
            [SYS_READY]
          </span>
          {activeView && (
            <span className="hidden lg:inline text-[10px] font-mono text-primary-container px-2 bg-primary-container/10 border border-primary-container/20">
              {getViewLabel(activeView)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-4">
          <div className="hidden sm:flex bg-stone-900 px-2 py-1 items-center border border-stone-800">
            <span className="material-symbols-outlined text-stone-500 text-sm mr-2">search</span>
            <input
              className="bg-transparent border-none p-0 text-[10px] font-mono uppercase focus:ring-0 focus:outline-none w-24 placeholder-stone-600 text-stone-300"
              placeholder="CMD_INPUT..."
              type="text"
            />
          </div>
          <div className="flex">
            <button className="w-10 h-10 flex items-center justify-center text-stone-400 hover:text-stone-200 transition-colors">
              <span className="material-symbols-outlined text-[18px]">terminal</span>
            </button>
            <button className="w-10 h-10 flex items-center justify-center text-stone-400 hover:text-stone-200 transition-colors relative">
              <span className="material-symbols-outlined text-[18px]">notifications</span>
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary-container rounded-full" />
            </button>
          </div>
        </div>
      </div>
      <div className="bg-stone-900/50 border-t border-stone-800 flex overflow-x-auto no-scrollbar items-center h-8 px-4 gap-6 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[9px] font-headline font-bold uppercase tracking-widest text-green-500">
            Connected
          </span>
        </div>
        {totalLaps && (
          <span className="text-[9px] font-mono text-stone-400">
            <span className="text-stone-600">LAPS:</span> {totalLaps}
          </span>
        )}
        {trackName && (
          <span className="text-[9px] font-mono text-stone-400">
            <span className="text-stone-600">LOC:</span> {trackName.toUpperCase()}
          </span>
        )}
        {raceName && (
          <span className="hidden md:inline text-[9px] font-mono text-stone-400">
            <span className="text-stone-600">EVENT:</span> {raceName}
          </span>
        )}
        <span className="ml-auto text-[9px] font-mono text-stone-600">[DATA_SYNC_OK]</span>
      </div>
    </header>
  );
}

function Sidebar({
  activeNav,
  setActiveNav,
  onRefresh,
  isRefreshing,
}: {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const navItems = [
    { id: "telemetry", label: "Telemetry", icon: "analytics", description: "Lap times & charts" },
    { id: "drivers", label: "Drivers", icon: "group", description: "Standings & info" },
    { id: "gaps", label: "Gaps", icon: "compare_arrows", description: "Gap analysis" },
    { id: "replay", label: "Replay", icon: "play_circle", description: "Race replay" },
    { id: "strategy", label: "Strategy", icon: "route", description: "Pit stops & stints" },
    { id: "recommendations", label: "Strategy AI", icon: "psychology", description: "AI recommendations" },
    { id: "tyres", label: "Tyres", icon: "tire_repair", description: "Compound usage" },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-12 bottom-0 h-auto flex-col z-40 border-r border-stone-800 bg-surface w-48">
      <div className="p-4 border-b border-stone-800 mb-2">
        <h3 className="font-headline uppercase text-[10px] tracking-widest font-bold text-primary-container">
          CONTROL UNIT
        </h3>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveNav(item.id)}
            className={`w-full flex items-center px-4 py-3 transition-colors ${
              activeNav === item.id
                ? "bg-stone-900 text-primary-container border-l-2 border-primary-container"
                : "text-stone-500 hover:text-stone-100 hover:bg-stone-900/50 border-l-2 border-transparent"
            }`}
          >
            <span
              className="material-symbols-outlined mr-3 text-lg"
              style={activeNav === item.id ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {item.icon}
            </span>
            <div className="text-left">
              <span className="font-headline uppercase text-[10px] tracking-widest font-bold block">
                {item.label}
              </span>
              <span className="text-[7px] font-mono text-stone-600 block">
                {item.description}
              </span>
            </div>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-stone-800 space-y-2">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="w-full bg-primary-container disabled:bg-stone-700 disabled:text-stone-400 text-white font-headline font-bold text-[10px] py-2 tracking-widest uppercase hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          {isRefreshing ? "REFRESHING" : "REFRESH"}
        </button>
        <div className="text-center text-[7px] font-mono text-stone-600">
          FastF1 + Next.js
        </div>
      </div>
    </aside>
  );
}

function MobileNav({
  activeNav,
  setActiveNav,
}: {
  activeNav: string;
  setActiveNav: (nav: string) => void;
}) {
  const navItems = [
    { id: "telemetry", label: "Telemetry", icon: "analytics" },
    { id: "drivers", label: "Drivers", icon: "group" },
    { id: "gaps", label: "Gaps", icon: "compare_arrows" },
    { id: "replay", label: "Replay", icon: "play_circle" },
    { id: "strategy", label: "Strategy", icon: "route" },
    { id: "recommendations", label: "AI", icon: "psychology" },
    { id: "tyres", label: "Tyres", icon: "tire_repair" },
  ];

  return (
    <footer className="md:hidden bg-surface border-t border-stone-800 flex justify-around items-center h-14 z-50 fixed bottom-0 w-full backdrop-blur-md bg-opacity-90">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveNav(item.id)}
          className={`flex flex-col items-center transition-colors ${
            activeNav === item.id ? "text-primary-container" : "text-stone-500"
          }`}
        >
          <span
            className="material-symbols-outlined text-[20px]"
            style={activeNav === item.id ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {item.icon}
          </span>
          <span className="text-[7px] font-black uppercase mt-1 tracking-tighter">{item.label}</span>
        </button>
      ))}
    </footer>
  );
}

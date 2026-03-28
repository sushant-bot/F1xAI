"use client";

import { useEffect, useState } from "react";
import type { RaceOverview, MetadataResponse } from "@/lib/api";
import { fetchMetadata } from "@/lib/api";

interface DriversViewProps {
  overview: RaceOverview;
}

export default function DriversView({ overview }: DriversViewProps) {
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [showTeams, setShowTeams] = useState(false);

  useEffect(() => {
    fetchMetadata()
      .then(setMetadata)
      .catch((err) => console.error("Failed to load metadata:", err));
  }, []);

  const sortedResults = overview.race_results
    .slice()
    .sort((a, b) => a.position - b.position);

  const teamMetadata = metadata?.teams ?? {};
  const driverMetadata = metadata?.drivers ?? {};

  const raceResultsByCode = sortedResults.reduce<Record<string, (typeof sortedResults)[number]>>((acc, item) => {
    acc[item.driver_code] = item;
    return acc;
  }, {});

  const getPositionChange = (grid: number, position: number) => {
    const change = grid - position;
    if (change > 0) return { value: `+${change}`, color: "text-green-500" };
    if (change < 0) return { value: String(change), color: "text-red-500" };
    return { value: "=", color: "text-stone-500" };
  };

  const TEAM_COLOR_CLASSES_BY_NAME: Record<string, { bg: string; text: string }> = {
    "Red Bull Racing": { bg: "bg-blue-500", text: "text-blue-400" },
    Mercedes: { bg: "bg-cyan-400", text: "text-cyan-300" },
    Ferrari: { bg: "bg-red-600", text: "text-red-500" },
    McLaren: { bg: "bg-orange-500", text: "text-orange-400" },
    "Aston Martin": { bg: "bg-emerald-600", text: "text-emerald-500" },
    Alpine: { bg: "bg-sky-500", text: "text-sky-400" },
    RB: { bg: "bg-indigo-500", text: "text-indigo-400" },
    AlphaTauri: { bg: "bg-indigo-500", text: "text-indigo-400" },
    "Alfa Romeo": { bg: "bg-rose-600", text: "text-rose-500" },
    Haas: { bg: "bg-zinc-400", text: "text-zinc-300" },
    Williams: { bg: "bg-cyan-500", text: "text-cyan-400" },
    Unknown: { bg: "bg-stone-500", text: "text-stone-400" },
  };

  const getDriverNumber = (driverCode: string): number | string => {
    if (driverMetadata[driverCode]) {
      return driverMetadata[driverCode].number;
    }
    return "--";
  };

  const getDriverTeam = (driverCode: string): string => {
    if (driverMetadata[driverCode]) {
      return driverMetadata[driverCode].team;
    }
    return "Unknown";
  };

  const getDriverNationality = (driverCode: string): string => {
    if (driverMetadata[driverCode]) {
      return driverMetadata[driverCode].nationality;
    }
    return "";
  };

  const getTeamColors = (driverCode: string) => {
    const team = getDriverTeam(driverCode);
    return TEAM_COLOR_CLASSES_BY_NAME[team] ?? TEAM_COLOR_CLASSES_BY_NAME.Unknown;
  };

  const getTeamColorsByName = (teamName: string) => {
    return TEAM_COLOR_CLASSES_BY_NAME[teamName] ?? TEAM_COLOR_CLASSES_BY_NAME.Unknown;
  };

  const getDriverHeadshot = (driverCode: string): string | null => {
    const fromRace = raceResultsByCode[driverCode]?.headshot_url;
    if (fromRace) {
      return fromRace;
    }
    return driverMetadata[driverCode]?.headshot_url ?? null;
  };

  const getTeamEngine = (driverCode: string): string => {
    const team = getDriverTeam(driverCode);
    return teamMetadata[team]?.engine ?? "Unknown";
  };

  // Group drivers by team
  const teamDrivers: Record<string, typeof sortedResults> = {};
  sortedResults.forEach((driver) => {
    const team = getDriverTeam(driver.driver_code);
    if (!teamDrivers[team]) teamDrivers[team] = [];
    teamDrivers[team].push(driver);
  });

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowTeams(false)}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
            !showTeams
              ? "bg-primary text-black"
              : "bg-stone-800 text-stone-400 hover:bg-stone-700"
          }`}
        >
          By Position
        </button>
        <button
          onClick={() => setShowTeams(true)}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
            showTeams
              ? "bg-primary text-black"
              : "bg-stone-800 text-stone-400 hover:bg-stone-700"
          }`}
        >
          By Team
        </button>
      </div>

      {/* Metadata Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="text-[8px] uppercase text-stone-500 tracking-widest">Driver Metadata</div>
          <div className="text-lg font-headline font-black text-white mt-1">{Object.keys(driverMetadata).length}</div>
          <div className="text-[9px] text-stone-500">Driver profiles loaded</div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="text-[8px] uppercase text-stone-500 tracking-widest">Team Metadata</div>
          <div className="text-lg font-headline font-black text-white mt-1">{Object.keys(teamMetadata).length}</div>
          <div className="text-[9px] text-stone-500">Teams with engine + color data</div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="text-[8px] uppercase text-stone-500 tracking-widest">Headshots</div>
          <div className="text-lg font-headline font-black text-primary-container mt-1">
            {sortedResults.filter((d) => Boolean(getDriverHeadshot(d.driver_code))).length}
          </div>
          <div className="text-[9px] text-stone-500">Photos available in session metadata</div>
        </div>
      </div>

      {/* Team Overview Cards */}
      {showTeams && metadata?.teams && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {Object.entries(teamMetadata).map(([teamName, teamData]) => {
            const drivers = teamDrivers[teamName] || [];
            const teamPoints = drivers.reduce((sum, d) => sum + d.points, 0);
            const bestFinish = Math.min(...drivers.map(d => d.position), 99);
            const teamColors = getTeamColorsByName(teamName);

            return (
              <div
                key={teamName}
                className="bg-surface-container border border-stone-800 p-3 instrument-border relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 w-full h-1 ${teamColors.bg}`}
                />
                <div className="mt-1">
                  <div className="text-[10px] font-headline font-bold text-white uppercase truncate">
                    {teamName}
                  </div>
                  <div className="text-[8px] text-stone-500 uppercase mb-2">
                    {teamData.engine}
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <div>
                      <span className="text-stone-500">Points: </span>
                      <span className="text-primary-container font-bold">{teamPoints}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Best: </span>
                      <span className={`font-bold ${teamColors.text}`}>
                        P{bestFinish === 99 ? "--" : bestFinish}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {drivers.map((d) => (
                      <span
                        key={d.driver_code}
                        className="text-[8px] px-1.5 py-0.5 bg-stone-800 text-stone-300 font-mono"
                      >
                        {d.driver_code}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Driver Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Total Drivers</span>
            <span className="text-[7px] font-mono text-stone-600">[GRID]</span>
          </div>
          <div className="text-xl font-headline font-black text-on-surface">
            {overview.metrics.total_drivers}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Finishers</span>
            <span className="text-[7px] font-mono text-green-500">[OK]</span>
          </div>
          <div className="text-xl font-headline font-black text-green-500">
            {sortedResults.filter(r => r.status === "Finished").length}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">DNF</span>
            <span className="text-[7px] font-mono text-primary-container">[WARN]</span>
          </div>
          <div className="text-xl font-headline font-black text-primary-container">
            {sortedResults.filter(r => r.status !== "Finished").length}
          </div>
        </div>
        <div className="bg-surface-container border border-stone-800 p-3 instrument-border">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[8px] font-bold uppercase tracking-widest text-stone-500">Points Leader</span>
            <span className="text-[7px] font-mono text-yellow-500">[P1]</span>
          </div>
          <div className="text-xl font-headline font-black text-yellow-500">
            {sortedResults[0]?.driver_code || "--"}
          </div>
        </div>
      </div>

      {/* Driver Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedResults.slice(0, 12).map((driver, idx) => {
          const posChange = getPositionChange(driver.grid_position, driver.position);
          const teamColors = getTeamColors(driver.driver_code);
          const bestLap = overview.best_laps.find(l => l.driver_code === driver.driver_code);
          const headshot = getDriverHeadshot(driver.driver_code);
          const engine = getTeamEngine(driver.driver_code);
          const initials = driver.driver_name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={`${driver.driver_code}-${idx}`}
              className="bg-surface-container border border-stone-800 p-4 instrument-border relative overflow-hidden"
            >
              {/* Team color accent */}
              <div
                className={`absolute top-0 left-0 w-1 h-full ${teamColors.bg}`}
              />

              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-stone-700 bg-stone-900 shrink-0">
                    {headshot ? (
                      <img
                        src={headshot}
                        alt={`${driver.driver_name} headshot`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-stone-300">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div
                    className={`w-8 h-8 flex items-center justify-center font-headline font-black text-sm ${
                      idx === 0 ? "bg-yellow-500/20 text-yellow-500" :
                      idx === 1 ? "bg-stone-400/20 text-stone-400" :
                      idx === 2 ? "bg-amber-600/20 text-amber-600" :
                      "bg-stone-800 text-stone-400"
                    }`}
                  >
                    {driver.status !== "Finished" ? "X" : driver.position}
                  </div>
                  <div>
                    <div className="font-headline font-bold text-white text-sm uppercase">
                      {driver.driver_name}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-stone-500">
                        #{getDriverNumber(driver.driver_code)}
                      </span>
                      <span className={`text-[8px] px-1 py-0.5 bg-stone-800 ${teamColors.text}`}>
                        {getDriverTeam(driver.driver_code)}
                      </span>
                      {getDriverNationality(driver.driver_code) && (
                        <span className="text-[8px] text-stone-600">
                          {getDriverNationality(driver.driver_code)}
                        </span>
                      )}
                    </div>
                    <div className="text-[8px] text-stone-600 uppercase mt-1">
                      Engine: {engine}
                    </div>
                  </div>
                </div>
                <div className={`text-xs font-mono font-bold ${posChange.color}`}>
                  {posChange.value}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-stone-900/50 p-2">
                  <div className="text-[7px] uppercase text-stone-600 mb-1">Grid</div>
                  <div className="text-sm font-bold font-mono">{driver.grid_position}</div>
                </div>
                <div className="bg-stone-900/50 p-2">
                  <div className="text-[7px] uppercase text-stone-600 mb-1">Points</div>
                  <div className="text-sm font-bold font-mono text-primary-container">
                    {driver.points}
                  </div>
                </div>
                <div className="bg-stone-900/50 p-2">
                  <div className="text-[7px] uppercase text-stone-600 mb-1">Best Lap</div>
                  <div className="text-[10px] font-bold font-mono">
                    {bestLap ? formatLapTime(bestLap.best_lap_time_seconds) : "--"}
                  </div>
                </div>
              </div>

              {driver.status !== "Finished" && (
                <div className="mt-3 pt-2 border-t border-stone-800">
                  <span className="text-[9px] font-mono text-primary-container uppercase">
                    {driver.status}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Driver Metadata Directory */}
      <div className="bg-surface border border-stone-800">
        <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
          <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em]">
            Driver Metadata Directory
          </h2>
          <span className="text-[7px] font-mono text-stone-600">[PHOTO + TEAM + ENGINE]</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-bold tracking-widest bg-stone-950">
                <th className="px-4 py-3 font-medium">Photo</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Engine</th>
                <th className="px-4 py-3 font-medium">Nationality</th>
              </tr>
            </thead>
            <tbody className="text-[9px] font-mono">
              {sortedResults.map((row) => {
                const headshot = getDriverHeadshot(row.driver_code);
                const teamColors = getTeamColors(row.driver_code);
                return (
                  <tr key={`meta-${row.driver_code}`} className="border-b border-stone-800/50 hover:bg-stone-900/30">
                    <td className="px-4 py-2.5">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-stone-700 bg-stone-900">
                        {headshot ? (
                          <img
                            src={headshot}
                            alt={`${row.driver_name} headshot`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-stone-300">
                            {row.driver_code}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-stone-400">{row.driver_code}</td>
                    <td className="px-4 py-2.5 text-white font-bold">{row.driver_name}</td>
                    <td className="px-4 py-2.5 text-stone-400">{getDriverNumber(row.driver_code)}</td>
                    <td className={`px-4 py-2.5 ${teamColors.text}`}>{getDriverTeam(row.driver_code)}</td>
                    <td className="px-4 py-2.5 text-stone-400">{getTeamEngine(row.driver_code)}</td>
                    <td className="px-4 py-2.5 text-stone-500">{getDriverNationality(row.driver_code) || "--"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Results Table */}
      <div className="bg-surface border border-stone-800">
        <div className="px-4 py-2 border-b border-stone-800 flex justify-between items-center bg-stone-900/50">
          <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.2em]">
            Complete Driver Standings
          </h2>
          <span className="text-[7px] font-mono text-stone-600">[ALL_DRIVERS]</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="text-[8px] uppercase text-stone-500 border-b border-stone-800 font-bold tracking-widest bg-stone-950">
                <th className="px-4 py-3 font-medium">Pos</th>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Grid</th>
                <th className="px-4 py-3 font-medium">Change</th>
                <th className="px-4 py-3 font-medium text-right">Points</th>
                <th className="px-4 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-[9px] font-mono">
              {sortedResults.map((row, idx) => {
                const posChange = getPositionChange(row.grid_position, row.position);
                const teamColors = getTeamColors(row.driver_code);
                return (
                  <tr
                    key={`${row.driver_code}-${row.position}-${idx}`}
                    className={`border-b border-stone-800/50 hover:bg-stone-900/30 ${
                      idx === 0 ? "bg-yellow-500/5" :
                      row.status !== "Finished" ? "bg-primary-container/5" : ""
                    }`}
                  >
                    <td className={`px-4 py-2.5 font-black ${
                      idx === 0 ? "text-yellow-500" :
                      row.status !== "Finished" ? "text-primary-container" : "text-stone-300"
                    }`}>
                      {row.status !== "Finished" ? "DNF" : String(row.position).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-2.5 text-stone-500">
                      {getDriverNumber(row.driver_code)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-0.5 h-4 ${teamColors.bg}`}
                        />
                        <span className={`font-bold ${row.status !== "Finished" ? "text-primary-container/80" : "text-white"}`}>
                          {row.driver_name}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-2.5 ${teamColors.text}`}>
                      {getDriverTeam(row.driver_code)}
                    </td>
                    <td className="px-4 py-2.5 text-stone-400">{row.grid_position}</td>
                    <td className={`px-4 py-2.5 font-bold ${posChange.color}`}>
                      {posChange.value}
                    </td>
                    <td className="px-4 py-2.5 text-right text-primary-container font-bold">
                      {row.points}
                    </td>
                    <td className={`px-4 py-2.5 text-right uppercase ${
                      idx === 0 ? "text-yellow-500" :
                      row.status !== "Finished" ? "text-primary-container" : "text-stone-500"
                    }`}>
                      {idx === 0 ? "WINNER" : row.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, "0")}`;
}

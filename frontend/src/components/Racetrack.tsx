"use client";

import { useMemo } from "react";

interface RacetrackProps {
  trackName?: string;
  driverPositions?: {
    driver_code: string;
    position: number;
    lap_progress?: number;
  }[];
  highlightedDriver?: string;
  showLabels?: boolean;
  className?: string;
}

const DRIVER_COLORS: Record<string, string> = {
  VER: "#3671C6", PER: "#3671C6",
  HAM: "#27F4D2", RUS: "#27F4D2",
  LEC: "#E8002D", SAI: "#E8002D",
  NOR: "#FF8700", PIA: "#FF8700",
  ALO: "#229971", STR: "#229971",
  GAS: "#2293D1", OCO: "#2293D1",
  TSU: "#6692FF", RIC: "#6692FF", DEV: "#6692FF", LAW: "#6692FF",
  BOT: "#C92D4B", ZHO: "#C92D4B",
  MAG: "#B6BABD", HUL: "#B6BABD",
  ALB: "#64C4FF", SAR: "#64C4FF", COL: "#64C4FF",
};

// Track layouts - simplified SVG paths for different circuits
const TRACK_LAYOUTS: Record<string, { path: string; sectors: number[][] }> = {
  default: {
    path: "M50 180 Q20 180 20 150 L20 50 Q20 20 50 20 L150 20 Q180 20 180 50 L180 100 Q180 130 150 130 L100 130 Q70 130 70 160 L70 180 Q70 200 50 200 Z",
    sectors: [[0, 33], [33, 66], [66, 100]],
  },
  monaco: {
    path: "M30 160 L30 100 Q30 80 50 80 L80 80 Q100 80 100 60 L100 40 Q100 20 120 20 L160 20 Q180 20 180 40 L180 80 Q180 100 160 100 L140 100 Q120 100 120 120 L120 160 Q120 180 100 180 L50 180 Q30 180 30 160 Z",
    sectors: [[0, 30], [30, 65], [65, 100]],
  },
  silverstone: {
    path: "M40 160 L40 80 Q40 50 70 50 L100 50 Q120 50 120 30 L150 30 Q170 30 170 50 L170 80 Q170 100 150 100 L130 100 Q110 100 110 120 L110 140 Q110 170 80 170 L60 170 Q40 170 40 160 Z",
    sectors: [[0, 35], [35, 70], [70, 100]],
  },
  spa: {
    path: "M20 100 L20 50 Q20 30 40 30 L60 30 Q80 30 90 50 L110 90 Q120 110 140 110 L160 110 Q180 110 180 130 L180 160 Q180 180 160 180 L100 180 Q80 180 70 160 L50 120 Q40 100 20 100 Z",
    sectors: [[0, 40], [40, 75], [75, 100]],
  },
  monza: {
    path: "M30 180 L30 40 Q30 20 50 20 L80 20 L100 40 L120 20 L150 20 Q170 20 170 40 L170 180 Q170 200 150 200 L50 200 Q30 200 30 180 Z",
    sectors: [[0, 25], [25, 60], [60, 100]],
  },
};

// Get point along SVG path at percentage t (0-1)
function getPointOnPath(pathElement: SVGPathElement | null, t: number): { x: number; y: number } {
  if (!pathElement) return { x: 100, y: 100 };
  const length = pathElement.getTotalLength();
  const point = pathElement.getPointAtLength(length * t);
  return { x: point.x, y: point.y };
}

export default function Racetrack({
  trackName = "default",
  driverPositions = [],
  highlightedDriver,
  showLabels = true,
  className = "",
}: RacetrackProps) {
  const trackKey = Object.keys(TRACK_LAYOUTS).includes(trackName.toLowerCase())
    ? trackName.toLowerCase()
    : "default";

  const track = TRACK_LAYOUTS[trackKey];

  // Calculate driver positions on track
  const positionedDrivers = useMemo(() => {
    return driverPositions.map((driver, idx) => {
      // Spread drivers along track based on position
      const progress = driver.lap_progress ?? (1 - (driver.position - 1) / Math.max(driverPositions.length, 1)) * 0.95 + 0.05;
      return {
        ...driver,
        progress: Math.max(0, Math.min(1, progress)),
      };
    });
  }, [driverPositions]);

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 200 220"
        className="w-full h-full"
        style={{ maxHeight: "300px" }}
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#333"
              strokeWidth="0.5"
              opacity="0.3"
            />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="200" height="220" fill="url(#grid)" />

        {/* Track outline (outer) */}
        <path
          d={track.path}
          fill="none"
          stroke="#444"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Track surface */}
        <path
          d={track.path}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Racing line */}
        <path
          d={track.path}
          fill="none"
          stroke="#444"
          strokeWidth="1"
          strokeDasharray="4 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />

        {/* Sector markers */}
        {track.sectors.map((sector, idx) => {
          const colors = ["#22c55e", "#eab308", "#ef4444"];
          return (
            <g key={idx}>
              <circle
                cx={30 + idx * 60}
                cy={210}
                r="4"
                fill={colors[idx]}
                opacity="0.8"
              />
              <text
                x={30 + idx * 60}
                y={218}
                textAnchor="middle"
                className="text-[6px] fill-stone-500 font-mono"
              >
                S{idx + 1}
              </text>
            </g>
          );
        })}

        {/* Start/Finish line */}
        <line
          x1="45"
          y1="176"
          x2="55"
          y2="176"
          stroke="#fff"
          strokeWidth="2"
        />
        <text
          x="50"
          y="192"
          textAnchor="middle"
          className="text-[7px] fill-stone-400 font-mono font-bold"
        >
          S/F
        </text>

        {/* Hidden path element for position calculation */}
        <path
          id="trackPath"
          d={track.path}
          fill="none"
          stroke="transparent"
        />

        {/* Driver markers */}
        {positionedDrivers.map((driver) => {
          // Calculate position along the track
          // Since we can't use getPointOnPath in SSR, we approximate
          const angle = driver.progress * Math.PI * 2 - Math.PI / 2;
          const cx = 100 + Math.cos(angle) * 60;
          const cy = 100 + Math.sin(angle) * 50;

          const isHighlighted = highlightedDriver === driver.driver_code;
          const color = DRIVER_COLORS[driver.driver_code] || "#666";

          return (
            <g key={driver.driver_code} filter={isHighlighted ? "url(#glow)" : undefined}>
              {/* Driver marker */}
              <circle
                cx={cx}
                cy={cy}
                r={isHighlighted ? 10 : 8}
                fill={color}
                stroke={isHighlighted ? "#fff" : "none"}
                strokeWidth="2"
                className="transition-all duration-300"
              />
              {/* Position number */}
              <text
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[6px] fill-white font-bold font-mono"
              >
                {driver.position}
              </text>
              {/* Driver code label */}
              {showLabels && driver.position <= 5 && (
                <text
                  x={cx + 12}
                  y={cy}
                  textAnchor="start"
                  dominantBaseline="middle"
                  className="text-[6px] fill-stone-400 font-mono"
                >
                  {driver.driver_code}
                </text>
              )}
            </g>
          );
        })}

        {/* Track name */}
        <text
          x="100"
          y="12"
          textAnchor="middle"
          className="text-[8px] fill-stone-500 font-headline font-bold uppercase tracking-widest"
        >
          {trackName !== "default" ? trackName.toUpperCase() : "CIRCUIT"}
        </text>
      </svg>

      {/* Legend */}
      {showLabels && positionedDrivers.length > 0 && (
        <div className="absolute bottom-0 right-0 bg-stone-900/80 p-2 border border-stone-800">
          <div className="grid grid-cols-5 gap-1">
            {positionedDrivers.slice(0, 10).map((driver) => (
              <div
                key={driver.driver_code}
                className={`flex items-center gap-1 px-1 py-0.5 ${
                  highlightedDriver === driver.driver_code ? "bg-stone-700" : ""
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: DRIVER_COLORS[driver.driver_code] || "#666" }}
                />
                <span className="text-[7px] font-mono text-stone-400">
                  {driver.driver_code}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Standalone mini track for use in cards/cells
export function MiniTrack({
  position,
  total,
  color = "#e10600",
}: {
  position: number;
  total: number;
  color?: string;
}) {
  const progress = 1 - (position - 1) / Math.max(total - 1, 1);
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  const cx = 15 + Math.cos(angle) * 10;
  const cy = 15 + Math.sin(angle) * 10;

  return (
    <svg viewBox="0 0 30 30" className="w-8 h-8">
      <circle
        cx="15"
        cy="15"
        r="10"
        fill="none"
        stroke="#333"
        strokeWidth="3"
      />
      <circle
        cx="15"
        cy="15"
        r="10"
        fill="none"
        stroke="#444"
        strokeWidth="1.5"
      />
      <circle cx={cx} cy={cy} r="4" fill={color} />
      <text
        x={cx}
        y={cy + 0.5}
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-[5px] fill-white font-bold"
      >
        {position}
      </text>
    </svg>
  );
}

/**
 * Map FastF1 session locations / race names to layout IDs from
 * https://github.com/julesr0y/f1-circuits-svg (filenames under circuits/minimal/).
 */

export const F1_CIRCUITS_SVG_REPO =
  "https://github.com/julesr0y/f1-circuits-svg";

function yearFromDate(dateIso?: string): number {
  if (!dateIso) return new Date().getFullYear();
  const y = Number(dateIso.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type ResolveCircuitOptions = {
  date?: string;
  raceName?: string;
};

/**
 * Pick the julesr0y layout id for the current session (track + optional date / race name).
 */
export function resolveF1CircuitLayoutId(
  trackName: string,
  options?: ResolveCircuitOptions,
): string {
  const year = yearFromDate(options?.date);
  const hay = norm(`${trackName} ${options?.raceName ?? ""}`);

  if (hay.includes("melbourne") || (hay.includes("australian") && hay.includes("grand prix"))) {
    return year >= 2022 ? "melbourne-2" : "melbourne-1";
  }

  if (
    hay.includes("barcelona") ||
    hay.includes("catalunya") ||
    hay.includes("montmelo") ||
    (hay.includes("spanish") && hay.includes("grand prix") && !hay.includes("valencia"))
  ) {
    if (year >= 2023) return "catalunya-6";
    if (year >= 2021) return "catalunya-5";
    if (year >= 2007) return "catalunya-4";
    if (year >= 2004) return "catalunya-3";
    if (year >= 1995) return "catalunya-2";
    return "catalunya-1";
  }

  if (hay.includes("silverstone") || (hay.includes("british") && hay.includes("grand prix"))) {
    return year >= 2010 ? "silverstone-8" : "silverstone-7";
  }

  if (
    hay.includes("francorchamps") ||
    hay.includes("spa francorchamps") ||
    (hay.includes("belgian") && hay.includes("grand prix"))
  ) {
    return "spa-francorchamps-4";
  }

  if (hay.includes("monaco") || hay.includes("monte carlo")) {
    return "monaco-6";
  }

  if (hay.includes("monza") || (hay.includes("italian") && hay.includes("grand prix"))) {
    return "monza-7";
  }

  if (hay.includes("sakhir") || hay.includes("bahrain")) {
    return "bahrain-1";
  }

  if (hay.includes("jeddah") || hay.includes("saudi")) {
    return "jeddah-1";
  }

  if (hay.includes("zandvoort") || (hay.includes("dutch") && hay.includes("grand prix"))) {
    return year >= 2021 ? "zandvoort-5" : "zandvoort-4";
  }

  if (hay.includes("marina") || (hay.includes("singapore") && hay.includes("grand prix"))) {
    if (year >= 2023) return "marina-bay-4";
    if (year >= 2015) return "marina-bay-3";
    if (year >= 2013) return "marina-bay-2";
    return "marina-bay-1";
  }

  if (hay.includes("suzuka") || (hay.includes("japanese") && hay.includes("grand prix"))) {
    return year >= 2003 ? "suzuka-2" : "suzuka-1";
  }

  if (hay.includes("yas marina") || hay.includes("yas-marina") || hay.includes("abu dhabi")) {
    return year >= 2021 ? "yas-marina-2" : "yas-marina-1";
  }

  if (hay.includes("austin") || (hay.includes("united states") && hay.includes("grand prix") && !hay.includes("miami") && !hay.includes("vegas"))) {
    return "austin-1";
  }

  if (hay.includes("miami")) {
    return "miami-1";
  }

  if (hay.includes("las vegas") || hay.includes("vegas")) {
    return "las-vegas-1";
  }

  if (
    hay.includes("rodriguez") ||
    hay.includes("hermanos") ||
    hay.includes("mexico city") ||
    (hay.includes("mexican") && hay.includes("grand prix"))
  ) {
    return year >= 2015 ? "mexico-city-3" : "mexico-city-2";
  }

  if (
    hay.includes("interlagos") ||
    hay.includes("sao paulo") ||
    (hay.includes("brazilian") && hay.includes("grand prix"))
  ) {
    return year >= 1990 ? "interlagos-2" : "interlagos-1";
  }

  if (hay.includes("baku") || (hay.includes("azerbaijan") && hay.includes("grand prix"))) {
    return "baku-1";
  }

  if (hay.includes("hungaroring") || hay.includes("budapest") || (hay.includes("hungarian") && hay.includes("grand prix"))) {
    return year >= 2003 ? "hungaroring-3" : "hungaroring-2";
  }

  if (hay.includes("spielberg") || hay.includes("red bull ring") || (hay.includes("austrian") && hay.includes("grand prix"))) {
    return year >= 1997 ? "spielberg-3" : "spielberg-2";
  }

  if (hay.includes("imola") || hay.includes("emilia romagna") || hay.includes("san marino")) {
    if (year >= 2020) return "imola-3";
    if (year >= 1995) return "imola-2";
    return "imola-1";
  }

  if (hay.includes("portim") || hay.includes("algarve") || (hay.includes("portuguese") && hay.includes("grand prix"))) {
    return "portimao-1";
  }

  if (hay.includes("shanghai") || (hay.includes("chinese") && hay.includes("grand prix"))) {
    return "shanghai-1";
  }

  if (hay.includes("montreal") || hay.includes("gilles villeneuve") || (hay.includes("canadian") && hay.includes("grand prix"))) {
    return year >= 1996 ? "montreal-6" : "montreal-5";
  }

  if (hay.includes("losail") || hay.includes("lusail") || (hay.includes("qatar") && hay.includes("grand prix"))) {
    return "lusail-1";
  }

  if (hay.includes("sochi")) {
    return "sochi-1";
  }

  if (hay.includes("istanbul")) {
    return "istanbul-1";
  }

  return "bahrain-1";
}

/** Layout IDs for the track-comparison tab labels (modern layouts). */
export const TRACK_COMPARISON_LAYOUT_BY_NAME: Record<string, string> = {
  Bahrain: "bahrain-1",
  "Saudi Arabia": "jeddah-1",
  Australia: "melbourne-2",
  Monaco: "monaco-6",
  Spain: "catalunya-6",
  "Great Britain": "silverstone-8",
  Italy: "monza-7",
  Belgium: "spa-francorchamps-4",
};

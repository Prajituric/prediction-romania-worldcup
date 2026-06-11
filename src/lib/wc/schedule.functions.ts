import { createServerFn } from "@tanstack/react-start";

const API_BASE = "https://api.football-data.org/v4";

const API_NAME_MAP: Record<string, string> = {
  "Türkiye": "Turkiye",
  "Turkey": "Turkiye",
  "Côte d'Ivoire": "Ivory Coast",
  "Congo DR": "DR Congo",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "South Korea": "Korea Republic",
  "USA": "United States",
  "Cape Verde Islands": "Cape Verde",
};
const normalize = (n: string) => API_NAME_MAP[n] ?? n;

export interface WCMatch {
  id: number;
  utcDate: string;
  status: "SCHEDULED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "SUSPENDED" | "POSTPONED" | "CANCELLED" | "TIMED";
  stage: string;
  group: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
}

// Server-side score cache — lives in the server process, shared across ALL
// users and devices. Once any request returns a real score for a match, every
// subsequent request (any device) returns that score even during API lag polls.
// Resets only on server restart, which is fine — next real poll refills it.
const SERVER_SCORE_CACHE: Record<number, { home: number; away: number }> = {};

export const getSchedule = createServerFn().handler(async (): Promise<WCMatch[]> => {
  const token = process.env.FOOTBALL_API_TOKEN;
  if (!token) return [];

  try {
    const res = await fetch(`${API_BASE}/competitions/WC/matches?season=2026`, {
      headers: { "X-Auth-Token": token },
    });
    if (!res.ok) return [];

    const data = await res.json();

    return (data.matches ?? []).map((m: any): WCMatch => {
      // fullTime is only guaranteed once status=FINISHED; during IN_PLAY the
      // API may serve it live or leave it null. Fall back to halfTime.
      const apiHome: number | null = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null;
      const apiAway: number | null = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null;

      // Write to server cache whenever the API gives real data
      if (apiHome != null && apiAway != null) {
        SERVER_SCORE_CACHE[m.id] = { home: apiHome, away: apiAway };
      }

      // Fall back to cached score when API returns null (status/score lag)
      const homeScore = apiHome ?? SERVER_SCORE_CACHE[m.id]?.home ?? null;
      const awayScore = apiAway ?? SERVER_SCORE_CACHE[m.id]?.away ?? null;

      return {
        id: m.id,
        utcDate: m.utcDate,
        status: m.status,
        stage: m.stage ?? "",
        group: m.group ? m.group.replace("GROUP_", "Group ") : null,
        homeTeam: normalize(m.homeTeam?.name ?? "TBD"),
        awayTeam: normalize(m.awayTeam?.name ?? "TBD"),
        homeScore,
        awayScore,
        venue: m.venue ?? null,
        winner: m.score?.winner ?? null,
      };
    });
  } catch {
    return [];
  }
});

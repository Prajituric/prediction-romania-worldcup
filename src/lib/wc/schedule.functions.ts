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

export const getSchedule = createServerFn().handler(async (): Promise<WCMatch[]> => {
  const token = process.env.FOOTBALL_API_TOKEN;
  if (!token) return [];

  try {
    const res = await fetch(`${API_BASE}/competitions/WC/matches?season=2026`, {
      headers: { "X-Auth-Token": token },
    });
    if (!res.ok) return [];

    const data = await res.json();

    return (data.matches ?? []).map((m: any): WCMatch => ({
      id: m.id,
      utcDate: m.utcDate,
      status: m.status,
      stage: m.stage ?? "",
      group: m.group ? m.group.replace("GROUP_", "Group ") : null,
      homeTeam: normalize(m.homeTeam?.name ?? "TBD"),
      awayTeam: normalize(m.awayTeam?.name ?? "TBD"),
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      venue: m.venue ?? null,
      winner: m.score?.winner ?? null,
    }));
  } catch {
    return [];
  }
});

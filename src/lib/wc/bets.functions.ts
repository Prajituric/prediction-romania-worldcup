import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EXACT_POINTS = 10;
const OUTCOME_POINTS = 3;

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

export interface BetRow {
  matchId: number;
  homeScore: number;
  awayScore: number;
  points: number;
  resolved: boolean;
}

export const saveBet = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: number; matchId: number; homeScore: number; awayScore: number }) => {
    if (!d || typeof d.userId !== "number") throw new Error("Missing userId.");
    if (typeof d.matchId !== "number") throw new Error("Missing matchId.");
    if (!Number.isInteger(d.homeScore) || d.homeScore < 0 || d.homeScore > 20) throw new Error("Invalid home score.");
    if (!Number.isInteger(d.awayScore) || d.awayScore < 0 || d.awayScore > 20) throw new Error("Invalid away score.");
    return d;
  })
  .handler(async ({ data }) => {
    const existing = await supabaseAdmin
      .from("bets")
      .select("id, resolved")
      .eq("user_id", data.userId)
      .eq("match_id", data.matchId)
      .maybeSingle();

    if (existing.data?.resolved) {
      throw new Error("This bet is already resolved and cannot be changed.");
    }

    if (existing.data) {
      const upd = await supabaseAdmin
        .from("bets")
        .update({ home_score: data.homeScore, away_score: data.awayScore })
        .eq("id", existing.data.id);
      if (upd.error) throw new Error(upd.error.message);
    } else {
      const ins = await supabaseAdmin.from("bets").insert({
        user_id: data.userId,
        match_id: data.matchId,
        home_score: data.homeScore,
        away_score: data.awayScore,
      });
      if (ins.error) throw new Error(ins.error.message);
    }
    return { ok: true };
  });

export const getUserBets = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: number }) => {
    if (!d || typeof d.userId !== "number") throw new Error("Missing userId.");
    return d;
  })
  .handler(async ({ data }): Promise<BetRow[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("bets")
      .select("match_id, home_score, away_score, points, resolved")
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      matchId: r.match_id,
      homeScore: r.home_score,
      awayScore: r.away_score,
      points: r.points ?? 0,
      resolved: !!r.resolved,
    }));
  });

interface FinishedMatch {
  id: number;
  homeScore: number;
  awayScore: number;
}

async function fetchFinishedMatches(): Promise<FinishedMatch[]> {
  const token = process.env.FOOTBALL_API_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches?season=2026&status=FINISHED", {
      headers: { "X-Auth-Token": token },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.matches ?? [])
      .filter((m: any) => m.status === "FINISHED" && m.score?.fullTime?.home !== null && m.score?.fullTime?.away !== null)
      .map((m: any): FinishedMatch => ({
        id: m.id,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
      }));
  } catch {
    return [];
  }
}

function scoreBet(
  predHome: number, predAway: number,
  actualHome: number, actualAway: number,
): number {
  if (predHome === actualHome && predAway === actualAway) return EXACT_POINTS;
  const predOutcome = Math.sign(predHome - predAway);
  const actualOutcome = Math.sign(actualHome - actualAway);
  if (predOutcome === actualOutcome) return OUTCOME_POINTS;
  return 0;
}

export const resolveBets = createServerFn({ method: "POST" }).handler(async () => {
  const finished = await fetchFinishedMatches();
  if (finished.length === 0) return { resolved: 0, pointsAwarded: 0 };

  const byId = new Map<number, FinishedMatch>();
  for (const m of finished) byId.set(m.id, m);

  const { data: pending, error } = await supabaseAdmin
    .from("bets")
    .select("id, user_id, match_id, home_score, away_score")
    .eq("resolved", false)
    .in("match_id", finished.map((m) => m.id));
  if (error) throw new Error(error.message);

  let resolved = 0;
  let pointsAwarded = 0;
  // Aggregate per-user deltas for predictions.points update
  const userDeltas: Record<number, number> = {};

  for (const bet of pending ?? []) {
    const actual = byId.get(bet.match_id);
    if (!actual) continue;
    const pts = scoreBet(bet.home_score, bet.away_score, actual.homeScore, actual.awayScore);
    await supabaseAdmin
      .from("bets")
      .update({ points: pts, resolved: true })
      .eq("id", bet.id);
    resolved++;
    pointsAwarded += pts;
    if (pts > 0) userDeltas[bet.user_id] = (userDeltas[bet.user_id] ?? 0) + pts;
  }

  // Add deltas to predictions.points (create row with 0 if missing? — only existing prediction rows get the delta)
  for (const [userIdStr, delta] of Object.entries(userDeltas)) {
    const userId = Number(userIdStr);
    const { data: pred } = await supabaseAdmin
      .from("predictions")
      .select("id, points")
      .eq("user_id", userId)
      .maybeSingle();
    if (pred) {
      await supabaseAdmin
        .from("predictions")
        .update({ points: (pred.points ?? 0) + delta })
        .eq("id", pred.id);
    }
  }

  return { resolved, pointsAwarded };
});

export { normalize };

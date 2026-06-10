import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface BetInfo {
  matchId: number;
  homeScore: number;
  awayScore: number;
  points: number;
  resolved: boolean;
}

// ── Scoring constants ─────────────────────────────────────────────────────────
// Exact score: +3pts, Correct outcome (win/draw): +1pt, Wrong: 0pts
export const BET_EXACT_PTS = 3;
export const BET_OUTCOME_PTS = 1;

export function scoreBet(
  betHome: number,
  betAway: number,
  actualHome: number,
  actualAway: number,
): number {
  if (betHome === actualHome && betAway === actualAway) return BET_EXACT_PTS;
  const actualOutcome = actualHome > actualAway ? "HOME" : actualHome < actualAway ? "AWAY" : "DRAW";
  const betOutcome = betHome > betAway ? "HOME" : betHome < betAway ? "AWAY" : "DRAW";
  return actualOutcome === betOutcome ? BET_OUTCOME_PTS : 0;
}

// ── Place / update a bet ──────────────────────────────────────────────────────
export const placeBet = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: number; matchId: number; matchUtcDate: string; homeScore: number; awayScore: number }) => {
    if (typeof d.userId !== "number") throw new Error("Not logged in.");
    if (typeof d.matchId !== "number") throw new Error("Missing matchId.");
    if (d.homeScore < 0 || d.homeScore > 20) throw new Error("Invalid home score.");
    if (d.awayScore < 0 || d.awayScore > 20) throw new Error("Invalid away score.");
    return d;
  })
  .handler(async ({ data }) => {
    // Server-side enforcement: lock 60 minutes before kickoff
    const minsUntilKickoff = (new Date(data.matchUtcDate).getTime() - Date.now()) / 60000;
    if (minsUntilKickoff <= 60) {
      throw new Error("Bets are locked 1 hour before kickoff.");
    }

    const existing = await supabaseAdmin
      .from("bets")
      .select("id, resolved")
      .eq("user_id", data.userId)
      .eq("match_id", data.matchId)
      .maybeSingle();

    if (existing.data?.resolved) {
      throw new Error("Match has already started — bet is locked.");
    }

    if (existing.data) {
      const { error } = await supabaseAdmin
        .from("bets")
        .update({ home_score: data.homeScore, away_score: data.awayScore })
        .eq("id", existing.data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("bets").insert({
        user_id: data.userId,
        match_id: data.matchId,
        home_score: data.homeScore,
        away_score: data.awayScore,
        points: 0,
        resolved: false,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ── Get all bets for a user ───────────────────────────────────────────────────
export const getUserBets = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: number }) => d)
  .handler(async ({ data }): Promise<BetInfo[]> => {
    const { data: bets, error } = await supabaseAdmin
      .from("bets")
      .select("match_id, home_score, away_score, points, resolved")
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return (bets ?? []).map((b) => ({
      matchId: b.match_id,
      homeScore: b.home_score,
      awayScore: b.away_score,
      points: b.points ?? 0,
      resolved: b.resolved ?? false,
    }));
  });

// ── Sum of resolved bet points for a user ─────────────────────────────────────
export const getUserBetPointsTotal = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: number }) => d)
  .handler(async ({ data }): Promise<number> => {
    const { data: bets } = await supabaseAdmin
      .from("bets")
      .select("points")
      .eq("user_id", data.userId)
      .eq("resolved", true);
    return (bets ?? []).reduce((sum, b) => sum + (b.points ?? 0), 0);
  });

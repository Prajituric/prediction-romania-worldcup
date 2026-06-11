import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ALL_KO_IDS, FINAL_ID, GROUPS, GROUP_LETTERS, type GroupRankings, type KnockoutPicks } from "./groupsData";

// --- Scoring constants ---
// Group stage: 3 pts for 1st correct, 2 for 2nd, 1 for 3rd, 0 for 4th
const GROUP_POSITION_POINTS = [3, 2, 1, 0];
// Perfect bracket bonus: +50 if all 31 knockout matches correct
const PERFECT_BRACKET_BONUS = 50;
// Champion bonus: +5 if Final winner correctly predicted
const CHAMPION_BONUS = 5;

export interface ScoreBreakdown {
  groupPoints: number;    // max 72
  knockoutPoints: number; // max 31
  perfectBonus: number;   // 0 or 50
  championBonus: number;  // 0 or 5
  total: number;
}

function calculatePoints(
  userGroupRankings: GroupRankings,
  userKnockoutPicks: KnockoutPicks,
  actualGroupRankings: GroupRankings,
  actualKnockoutResults: KnockoutPicks,
): ScoreBreakdown {
  // Group stage points
  let groupPoints = 0;
  for (const g of GROUP_LETTERS) {
    const user = userGroupRankings[g];
    const actual = actualGroupRankings[g];
    if (!user || !actual) continue;
    for (let pos = 0; pos < 4; pos++) {
      if (user[pos] === actual[pos]) groupPoints += GROUP_POSITION_POINTS[pos];
    }
  }

  // Knockout points
  let knockoutPoints = 0;
  for (const id of ALL_KO_IDS) {
    if (actualKnockoutResults[id] && userKnockoutPicks[id] && actualKnockoutResults[id] === userKnockoutPicks[id]) {
      knockoutPoints++;
    }
  }

  // Perfect bracket bonus
  const perfectBonus = knockoutPoints === ALL_KO_IDS.length ? PERFECT_BRACKET_BONUS : 0;

  // Champion bonus (+5 if Final winner correct, on top of the 1pt for the match)
  const championBonus =
    actualKnockoutResults[FINAL_ID] &&
    userKnockoutPicks[FINAL_ID] &&
    actualKnockoutResults[FINAL_ID] === userKnockoutPicks[FINAL_ID]
      ? CHAMPION_BONUS
      : 0;

  return {
    groupPoints,
    knockoutPoints,
    perfectBonus,
    championBonus,
    total: groupPoints + knockoutPoints + perfectBonus + championBonus,
  };
}

/** Returns true only for predictions that are fully complete (all 12 groups, 8 thirds, 31 KO picks). */
function isCompletePrediction(r: any): boolean {
  const groups = r.group_rankings as Record<string, string[]> | null;
  if (!groups || Object.keys(groups).length < 12) return false;
  if (!Object.values(groups).every((g: any) => Array.isArray(g) && g.length === 4)) return false;
  const picks = r.knockout_picks as Record<string, string> | null;
  if (!picks) return false;
  try {
    const thirds = JSON.parse(picks["__thirds__"] ?? "null");
    if (!Array.isArray(thirds) || thirds.length !== 8) return false;
  } catch { return false; }
  return ALL_KO_IDS.every((id) => !!picks[id]);
}

function validateGroupRankings(gr: any): gr is GroupRankings {
  if (!gr || typeof gr !== "object") return false;
  for (const g of GROUP_LETTERS) {
    const arr = gr[g];
    if (!Array.isArray(arr) || arr.length !== 4) return false;
    const teams = GROUPS[g];
    const set = new Set(arr);
    if (set.size !== 4) return false;
    for (const t of arr) if (!teams.includes(t)) return false;
  }
  return true;
}

export const registerUser = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string }) => {
    const name = (d?.name ?? "").trim();
    if (name.length < 2 || name.length > 60) throw new Error("Name must be 2-60 characters.");
    return { name };
  })
  .handler(async ({ data }) => {
    const existing = await supabaseAdmin.from("users").select("id,name").ilike("name", data.name).maybeSingle();
    if (existing.data) return { userId: existing.data.id as number, name: existing.data.name as string };
    const ins = await supabaseAdmin.from("users").insert({ name: data.name }).select("id,name").single();
    if (ins.error) throw new Error(ins.error.message);
    return { userId: ins.data!.id as number, name: ins.data!.name as string };
  });

export const savePredictions = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: number; groupRankings: GroupRankings; knockoutPicks: KnockoutPicks }) => {
    if (!d || typeof d.userId !== "number") throw new Error("Missing userId.");
    if (!validateGroupRankings(d.groupRankings)) throw new Error("Invalid group rankings.");
    if (!d.knockoutPicks || typeof d.knockoutPicks !== "object") throw new Error("Invalid knockout picks.");
    return d;
  })
  .handler(async ({ data }) => {
    // Compute points only if actual results exist AND have real data (not empty objects)
    const actual = await supabaseAdmin.from("actual_results").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    let breakdown: ScoreBreakdown = { groupPoints: 0, knockoutPoints: 0, perfectBonus: 0, championBonus: 0, total: 0 };
    const hasActualData = actual.data &&
      actual.data.group_rankings_actual &&
      Object.keys(actual.data.group_rankings_actual).length > 0;
    if (hasActualData) {
      breakdown = calculatePoints(
        data.groupRankings,
        data.knockoutPicks,
        actual.data.group_rankings_actual as GroupRankings,
        actual.data.knockout_results_actual as KnockoutPicks,
      );
    }

    const existing = await supabaseAdmin.from("predictions").select("id").eq("user_id", data.userId).maybeSingle();
    if (existing.data) {
      const upd = await supabaseAdmin.from("predictions").update({
        group_rankings: data.groupRankings,
        knockout_picks: data.knockoutPicks,
        points: breakdown.total,
      }).eq("id", existing.data.id);
      if (upd.error) throw new Error(upd.error.message);
    } else {
      const ins = await supabaseAdmin.from("predictions").insert({
        user_id: data.userId,
        group_rankings: data.groupRankings,
        knockout_picks: data.knockoutPicks,
        points: breakdown.total,
      });
      if (ins.error) throw new Error(ins.error.message);
    }
    return { ok: true, points: breakdown.total, breakdown };
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const [{ data: predictions, error }, { data: betRows }, { data: actualRow }] = await Promise.all([
    supabaseAdmin.from("predictions").select("user_id, users(name), group_rankings, knockout_picks"),
    supabaseAdmin.from("bets").select("user_id, points").eq("resolved", true),
    supabaseAdmin.from("actual_results").select("group_rankings_actual, knockout_results_actual").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);

  // Points are driven exclusively by the sync-wc-results Edge Function which
  // only runs once the tournament has started (2026-06-11). Guard against any
  // stale test data in the DB by also requiring the tournament to have begun.
  const tournamentStarted = new Date() >= TOURNAMENT_START;
  const hasActualResults =
    tournamentStarted &&
    !!actualRow?.group_rankings_actual &&
    Object.keys(actualRow.group_rankings_actual as object).length > 0;

  // Sum resolved bet points per user
  const betPts: Record<number, number> = {};
  for (const b of betRows ?? []) {
    betPts[b.user_id] = (betPts[b.user_id] ?? 0) + (b.points ?? 0);
  }

  return (predictions ?? [])
    .filter((r: any) => isCompletePrediction(r))
    .map((r: any) => {
      let predPts = 0;
      if (hasActualResults) {
        // Always recalculate live from actual_results — never use the stale
        // stored points column (which was 0 when picks were saved pre-tournament).
        const breakdown = calculatePoints(
          r.group_rankings as GroupRankings,
          r.knockout_picks as KnockoutPicks,
          actualRow!.group_rankings_actual as GroupRankings,
          (actualRow!.knockout_results_actual ?? {}) as KnockoutPicks,
        );
        predPts = breakdown.total;
      }
      return {
        userId: r.user_id as number,
        name: r.users?.name ?? "Unknown",
        predictionPoints: predPts,
        betPoints: betPts[r.user_id] ?? 0,
        points: predPts + (betPts[r.user_id] ?? 0),
      };
    })
    .sort((a, b) => b.points - a.points);
});

export const getUserPrediction = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: number }) => d)
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("predictions")
      .select("group_rankings, knockout_picks, points")
      .eq("user_id", data.userId)
      .maybeSingle();
    return row
      ? { groupRankings: row.group_rankings, knockoutPicks: row.knockout_picks, points: row.points }
      : null;
  });

const TOURNAMENT_START = new Date("2026-06-11T00:00:00Z");

export const getActualResults = createServerFn({ method: "GET" }).handler(async () => {
  // Never surface actual results before the tournament begins — guards against
  // stale test data in the DB affecting accuracy displays and bracket views.
  if (new Date() < TOURNAMENT_START) return null;

  const { data } = await supabaseAdmin
    .from("actual_results")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const hasData = data && data.group_rankings_actual && Object.keys(data.group_rankings_actual).length > 0;
  return hasData
    ? {
        groupRankings: data.group_rankings_actual as GroupRankings,
        knockoutResults: data.knockout_results_actual as KnockoutPicks,
      }
    : null;
});

// adminSetActualResults removed — actual results are driven exclusively by the
// sync-wc-results Supabase Edge Function (fetches from football-data.org API).

export const getCommunityStats = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("predictions")
    .select("group_rankings, knockout_picks");

  if (!data || data.length === 0) return { groupWinners: {}, champions: [] };

  // Only count fully complete predictions (same rule as leaderboard)
  const complete = (data as any[]).filter(isCompletePrediction);
  const total = complete.length;
  if (total === 0) return { groupWinners: {}, champions: [] };

  // Most voted group winner per group
  const groupWinners: Record<string, { team: string; votes: number; total: number }> = {};
  for (const g of GROUP_LETTERS) {
    const tally: Record<string, number> = {};
    for (const row of complete) {
      const team = (row.group_rankings as Record<string, string[]>)?.[g]?.[0];
      if (team) tally[team] = (tally[team] ?? 0) + 1;
    }
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    if (top) groupWinners[g] = { team: top[0], votes: top[1], total };
  }

  // Most voted champion (Final winner pick)
  const champTally: Record<string, number> = {};
  for (const row of complete) {
    const champ = (row.knockout_picks as Record<string, string>)?.[FINAL_ID];
    if (champ) champTally[champ] = (champTally[champ] ?? 0) + 1;
  }
  const champions = Object.entries(champTally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([team, votes]) => ({ team, votes, total }));

  return { groupWinners, champions };
});

// resolveBracketFromActual removed — only used by admin.results.tsx (which no longer exists in the nav).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Environment ────────────────────────────────────────────────────────────
const FOOTBALL_TOKEN = Deno.env.get("FOOTBALL_API_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const API_BASE = "https://api.football-data.org/v4";

// ── App data (mirrored from groupsData.ts) ────────────────────────────────
const GROUPS: Record<string, string[]> = {
  A: ["Mexico", "South Africa", "Korea Republic", "Czechia"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Turkiye"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};
const GROUP_LETTERS = Object.keys(GROUPS);
const POSITION_POINTS: Record<number, number> = { 1: 9, 2: 7, 3: 4, 4: 0 };

const R32_IDS = Array.from({ length: 16 }, (_, i) => `R32_${i + 1}`);
const R16_IDS = Array.from({ length: 8 }, (_, i) => `R16_${i + 1}`);
const QF_IDS = Array.from({ length: 4 }, (_, i) => `QF_${i + 1}`);
const SF_IDS = Array.from({ length: 2 }, (_, i) => `SF_${i + 1}`);
const FINAL_ID = "FINAL";
const ALL_KO_IDS = [...R32_IDS, ...R16_IDS, ...QF_IDS, ...SF_IDS, FINAL_ID];

// ── Team name normalisation (API → app) ───────────────────────────────────
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

// ── Scoring (mirrored from predictions.functions.ts) ──────────────────────
const GROUP_POS_PTS = [3, 2, 1, 0];
const PERFECT_BONUS = 50;
const CHAMPION_BONUS = 5;

function calcPoints(
  userG: Record<string, string[]>,
  userK: Record<string, string>,
  actualG: Record<string, string[]>,
  actualK: Record<string, string>,
): number {
  let pts = 0;
  for (const g of GROUP_LETTERS) {
    const u = userG[g], a = actualG[g];
    if (!u || !a) continue;
    for (let i = 0; i < 4; i++) if (u[i] === a[i]) pts += GROUP_POS_PTS[i];
  }
  let ko = 0;
  for (const id of ALL_KO_IDS) {
    if (actualK[id] && userK[id] && actualK[id] === userK[id]) ko++;
  }
  pts += ko;
  if (ko === ALL_KO_IDS.length) pts += PERFECT_BONUS;
  if (actualK[FINAL_ID] && userK[FINAL_ID] && actualK[FINAL_ID] === userK[FINAL_ID]) pts += CHAMPION_BONUS;
  return pts;
}

// ── Bet scoring ───────────────────────────────────────────────────────────
const BET_EXACT_PTS = 10;
const BET_OUTCOME_PTS = 3;

function scoreBet(ph: number, pa: number, ah: number, aa: number): number {
  if (ph === ah && pa === aa) return BET_EXACT_PTS;
  if (Math.sign(ph - pa) === Math.sign(ah - aa)) return BET_OUTCOME_PTS;
  return 0;
}

// ── Bracket resolution (mirrored from bracketResolver.ts) ─────────────────
const R32_SPEC = [
  { id: "R32_1",  s1: { k: "winner", g: "A" },  s2: { k: "third",  gs: ["C","D","E"] } },
  { id: "R32_2",  s1: { k: "winner", g: "B" },  s2: { k: "runner", g: "F" } },
  { id: "R32_3",  s1: { k: "winner", g: "C" },  s2: { k: "third",  gs: ["A","B","F"] } },
  { id: "R32_4",  s1: { k: "winner", g: "D" },  s2: { k: "runner", g: "E" } },
  { id: "R32_5",  s1: { k: "winner", g: "E" },  s2: { k: "third",  gs: ["D","E","F"] } },
  { id: "R32_6",  s1: { k: "winner", g: "F" },  s2: { k: "runner", g: "D" } },
  { id: "R32_7",  s1: { k: "winner", g: "G" },  s2: { k: "third",  gs: ["G","H","I"] } },
  { id: "R32_8",  s1: { k: "winner", g: "H" },  s2: { k: "runner", g: "I" } },
  { id: "R32_9",  s1: { k: "winner", g: "I" },  s2: { k: "third",  gs: ["H","I","J"] } },
  { id: "R32_10", s1: { k: "winner", g: "J" },  s2: { k: "runner", g: "K" } },
  { id: "R32_11", s1: { k: "winner", g: "K" },  s2: { k: "third",  gs: ["J","K","L"] } },
  { id: "R32_12", s1: { k: "winner", g: "L" },  s2: { k: "runner", g: "G" } },
  { id: "R32_13", s1: { k: "runner", g: "A" },  s2: { k: "runner", g: "B" } },
  { id: "R32_14", s1: { k: "runner", g: "C" },  s2: { k: "runner", g: "H" } },
  { id: "R32_15", s1: { k: "runner", g: "J" },  s2: { k: "runner", g: "L" } },
  { id: "R32_16", s1: { k: "bestThird" },        s2: { k: "remainingRunner" } },
] as const;

function buildBracket(
  rankings: Record<string, string[]>,
  picks: Record<string, string>,
): { id: string; team1: string | null; team2: string | null; winner: string | null }[] {
  const byGroup: Record<string, { winner: string; runner: string; third: string; pts: number }> = {};
  const allThirds: { team: string; g: string; pts: number }[] = [];

  for (const g of GROUP_LETTERS) {
    const order = rankings[g];
    if (!order || order.length !== 4) continue;
    byGroup[g] = {
      winner: order[0], runner: order[1], third: order[2],
      pts: POSITION_POINTS[3],
    };
    allThirds.push({ team: order[2], g, pts: POSITION_POINTS[3] });
  }

  const sortedThirds = [...allThirds].sort((a, b) => b.pts - a.pts || a.team.localeCompare(b.team));
  const qualThirds = sortedThirds.slice(0, 8);
  const qualThirdGroups = new Set(qualThirds.map((t) => t.g));
  const thirdByGroup: Record<string, string> = {};
  for (const t of qualThirds) thirdByGroup[t.g] = t.team;

  const used = new Set<string>();
  const r32: { id: string; team1: string | null; team2: string | null; winner: string | null }[] = [];

  const pickThird = (gs: readonly string[]): string | null => {
    const candidates = gs
      .filter((g) => qualThirdGroups.has(g) && thirdByGroup[g] && !used.has(thirdByGroup[g]))
      .map((g) => ({ team: thirdByGroup[g], g }));
    candidates.sort((a, b) => a.team.localeCompare(b.team));
    return candidates[0]?.team ?? null;
  };

  const resolveSlot = (s: any): string | null => {
    if (s.k === "winner") {
      const t = byGroup[s.g]?.winner;
      if (t && !used.has(t)) { used.add(t); return t; } return null;
    }
    if (s.k === "runner") {
      const t = byGroup[s.g]?.runner;
      if (t && !used.has(t)) { used.add(t); return t; } return null;
    }
    if (s.k === "third") {
      const t = pickThird(s.gs);
      if (t) { used.add(t); return t; } return null;
    }
    if (s.k === "bestThird") {
      const remaining = qualThirds.filter((t) => !used.has(t.team));
      remaining.sort((a, b) => b.pts - a.pts || a.team.localeCompare(b.team));
      const t = remaining[0]?.team ?? null;
      if (t) used.add(t); return t;
    }
    if (s.k === "remainingRunner") {
      const runners = GROUP_LETTERS.map((g) => byGroup[g]?.runner).filter((t): t is string => !!t && !used.has(t));
      runners.sort((a, b) => a.localeCompare(b));
      const t = runners[0] ?? null;
      if (t) used.add(t); return t;
    }
    return null;
  };

  for (const spec of R32_SPEC) {
    r32.push({ id: spec.id, team1: resolveSlot(spec.s1), team2: resolveSlot(spec.s2), winner: picks[spec.id] ?? null });
  }

  const matchById: Record<string, { id: string; team1: string | null; team2: string | null; winner: string | null }> = {};
  for (const m of r32) matchById[m.id] = m;

  const buildNext = (prevIds: string[], nextIds: string[]) => {
    for (let i = 0; i < nextIds.length; i++) {
      const a = matchById[prevIds[i * 2]];
      const b = matchById[prevIds[i * 2 + 1]];
      const id = nextIds[i];
      const m = { id, team1: a?.winner ?? null, team2: b?.winner ?? null, winner: picks[id] ?? null };
      if (m.winner && m.winner !== m.team1 && m.winner !== m.team2) m.winner = null;
      matchById[id] = m;
    }
  };

  buildNext(R32_IDS, R16_IDS);
  buildNext(R16_IDS, QF_IDS);
  buildNext(QF_IDS, SF_IDS);
  buildNext(SF_IDS, [FINAL_ID]);

  return Object.values(matchById);
}

// ── Helper: throttle-safe fetch ────────────────────────────────────────────
async function apiFetch(path: string): Promise<{ data: any; remaining: number }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "X-Auth-Token": FOOTBALL_TOKEN },
  });
  const remaining = parseInt(res.headers.get("X-Requests-Available-Minute") ?? "10");
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return { data: await res.json(), remaining };
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── 1. Fetch group standings ──────────────────────────────────────────
    const { data: standingsData, remaining } = await apiFetch(
      "/competitions/WC/standings?season=2026",
    );

    if (remaining < 2) {
      return json({ ok: false, reason: "rate_limited" }, 429);
    }

    const groupRankings: Record<string, string[]> = {};
    const groupStandings: Record<string, any[]> = {};

    for (const standing of standingsData.standings ?? []) {
      // API group: "GROUP_A", "GROUP_B", etc.
      const letter = (standing.group as string)?.replace("GROUP_", "");
      if (!GROUP_LETTERS.includes(letter)) continue;
      const sorted = [...standing.table].sort((a: any, b: any) => a.position - b.position);
      const top4 = sorted.slice(0, 4).map((row: any) => normalize(row.team.name));
      if (top4.length === 4) groupRankings[letter] = top4;

      groupStandings[letter] = sorted.map((row: any) => ({
        team: normalize(row.team.name),
        played: row.playedGames ?? 0,
        won: row.won ?? 0,
        drawn: row.draw ?? 0,
        lost: row.lost ?? 0,
        goalsFor: row.goalsFor ?? 0,
        goalsAgainst: row.goalsAgainst ?? 0,
        goalDiff: row.goalDifference ?? 0,
        points: row.points ?? 0,
      }));
    }

    // Fill in any groups not yet in standings with the original group order
    for (const g of GROUP_LETTERS) {
      if (!groupRankings[g]) groupRankings[g] = [...GROUPS[g]];
      if (!groupStandings[g]) {
        groupStandings[g] = GROUPS[g].map((team) => ({
          team, played: 0, won: 0, drawn: 0, lost: 0,
          goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
        }));
      }
    }

    // ── 2. Fetch all matches (knockout results + finished match scores) ───
    const { data: matchesData } = await apiFetch(
      "/competitions/WC/matches?season=2026",
    );

    // Build bracket from current standings so we can map team pairs → match IDs
    const bracketMatches = buildBracket(groupRankings, {});
    const matchIdByTeams: Record<string, string> = {};
    for (const m of bracketMatches) {
      if (m.team1 && m.team2) {
        matchIdByTeams[`${m.team1}|${m.team2}`] = m.id;
        matchIdByTeams[`${m.team2}|${m.team1}`] = m.id;
      }
    }

    const KO_STAGES = new Set([
      "LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL",
    ]);

    const knockoutResults: Record<string, string> = {};
    const finishedMatches: { id: number; homeScore: number; awayScore: number }[] = [];

    for (const match of matchesData.matches ?? []) {
      if (match.status === "FINISHED" && match.score?.fullTime?.home !== null && match.score?.fullTime?.away !== null) {
        finishedMatches.push({
          id: match.id,
          homeScore: match.score.fullTime.home,
          awayScore: match.score.fullTime.away,
        });
      }

      if (!KO_STAGES.has(match.stage)) continue;
      if (match.status !== "FINISHED") continue;
      if (!match.score?.winner) continue;

      const home = normalize(match.homeTeam.name);
      const away = normalize(match.awayTeam.name);
      const winner = match.score.winner === "HOME_TEAM" ? home : away;

      const matchId =
        matchIdByTeams[`${home}|${away}`] ??
        matchIdByTeams[`${away}|${home}`];

      if (matchId) knockoutResults[matchId] = winner;
    }

    // ── 3. Upsert actual_results ──────────────────────────────────────────
    await supabase.from("actual_results").delete().neq("id", -1);
    const { error: insErr } = await supabase.from("actual_results").insert({
      group_rankings_actual: groupRankings,
      knockout_results_actual: knockoutResults,
      group_standings_actual: groupStandings,
    });
    if (insErr) throw new Error(insErr.message);

    // ── 4. Recalculate all users' bracket points ──────────────────────────
    const { data: predictions } = await supabase
      .from("predictions")
      .select("id, user_id, group_rankings, knockout_picks");

    // Map user_id → base prediction points (before bet bonuses)
    const userBasePoints: Record<number, number> = {};
    for (const row of predictions ?? []) {
      const pts = calcPoints(
        row.group_rankings,
        row.knockout_picks,
        groupRankings,
        knockoutResults,
      );
      userBasePoints[row.user_id] = pts;
    }

    // ── 5. Resolve bets for finished matches ──────────────────────────────
    const finishedById = new Map<number, { homeScore: number; awayScore: number }>();
    for (const m of finishedMatches) finishedById.set(m.id, m);

    const { data: pendingBets } = await supabase
      .from("bets")
      .select("id, user_id, match_id, home_score, away_score")
      .eq("resolved", false)
      .in("match_id", finishedMatches.map((m) => m.id));

    let betsResolved = 0;
    for (const bet of pendingBets ?? []) {
      const actual = finishedById.get(bet.match_id);
      if (!actual) continue;
      const pts = scoreBet(bet.home_score, bet.away_score, actual.homeScore, actual.awayScore);
      await supabase
        .from("bets")
        .update({ points: pts, resolved: true })
        .eq("id", bet.id);
      betsResolved++;
    }

    // ── 6. Aggregate all bet points per user + write final predictions.points ─
    const { data: allBetPoints } = await supabase
      .from("bets")
      .select("user_id, points")
      .eq("resolved", true);

    const userBetPoints: Record<number, number> = {};
    for (const b of allBetPoints ?? []) {
      userBetPoints[b.user_id] = (userBetPoints[b.user_id] ?? 0) + (b.points ?? 0);
    }

    let updated = 0;
    for (const row of predictions ?? []) {
      const total = (userBasePoints[row.user_id] ?? 0) + (userBetPoints[row.user_id] ?? 0);
      await supabase.from("predictions").update({ points: total }).eq("id", row.id);
      updated++;
    }

    return json({
      ok: true,
      groupsResolved: Object.keys(groupRankings).length,
      knockoutResultsCount: Object.keys(knockoutResults).length,
      finishedMatches: finishedMatches.length,
      betsResolved,
      usersUpdated: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(err);
    return json({ ok: false, error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

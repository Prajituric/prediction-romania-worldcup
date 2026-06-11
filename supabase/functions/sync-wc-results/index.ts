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

// ── Bracket resolution (mirrored from bracketResolver.ts) ─────────────────
// Official FIFA 2026 Round-of-32 pairings — kept in sync with bracketResolver.ts
const R32_SPEC = [
  { id: "R32_1",  s1: { k: "runner", g: "A" },  s2: { k: "runner",  g: "B" } },
  { id: "R32_2",  s1: { k: "winner", g: "F" },  s2: { k: "runner",  g: "C" } },
  { id: "R32_3",  s1: { k: "winner", g: "C" },  s2: { k: "runner",  g: "F" } },
  { id: "R32_4",  s1: { k: "winner", g: "E" },  s2: { k: "third",   gs: ["A","B","C","D","F"] } },
  { id: "R32_5",  s1: { k: "runner", g: "E" },  s2: { k: "runner",  g: "I" } },
  { id: "R32_6",  s1: { k: "winner", g: "A" },  s2: { k: "third",   gs: ["C","E","F","H","I"] } },
  { id: "R32_7",  s1: { k: "runner", g: "D" },  s2: { k: "runner",  g: "G" } },
  { id: "R32_8",  s1: { k: "winner", g: "D" },  s2: { k: "third",   gs: ["B","E","F","I","J"] } },
  { id: "R32_9",  s1: { k: "winner", g: "I" },  s2: { k: "third",   gs: ["C","D","F","G","H"] } },
  { id: "R32_10", s1: { k: "winner", g: "K" },  s2: { k: "third",   gs: ["D","E","I","J","L"] } },
  { id: "R32_11", s1: { k: "runner", g: "K" },  s2: { k: "runner",  g: "L" } },
  { id: "R32_12", s1: { k: "winner", g: "G" },  s2: { k: "third",   gs: ["A","E","H","I","J"] } },
  { id: "R32_13", s1: { k: "winner", g: "B" },  s2: { k: "third",   gs: ["E","F","G","I","J"] } },
  { id: "R32_14", s1: { k: "winner", g: "H" },  s2: { k: "runner",  g: "J" } },
  { id: "R32_15", s1: { k: "winner", g: "J" },  s2: { k: "runner",  g: "H" } },
  { id: "R32_16", s1: { k: "winner", g: "L" },  s2: { k: "third",   gs: ["E","H","I","J","K"] } },
] as const;

function buildBracket(
  rankings: Record<string, string[]>,
  picks: Record<string, string>,
  teamActualPts: Record<string, number> = {},
): { id: string; team1: string | null; team2: string | null; winner: string | null }[] {
  const byGroup: Record<string, { winner: string; runner: string; third: string; pts: number }> = {};
  const allThirds: { team: string; g: string; pts: number }[] = [];

  for (const g of GROUP_LETTERS) {
    const order = rankings[g];
    if (!order || order.length !== 4) continue;
    const thirdTeam = order[2];
    const thirdPts = teamActualPts[thirdTeam] ?? POSITION_POINTS[3];
    byGroup[g] = { winner: order[0], runner: order[1], third: thirdTeam, pts: thirdPts };
    allThirds.push({ team: thirdTeam, g, pts: thirdPts });
  }

  const sortedThirds = [...allThirds].sort((a, b) => b.pts - a.pts || a.team.localeCompare(b.team));
  const qualThirds = sortedThirds.slice(0, 8);

  // Bipartite matching — same algorithm as bracketResolver.ts to ensure
  // third-place slot assignment is correct and never leaves a slot empty.
  const thirdSlots = R32_SPEC
    .filter((s) => s.s2.k === "third")
    .map((s) => ({ matchId: s.id, groups: (s.s2 as { k: "third"; gs: readonly string[] }).gs }));

  const sn = thirdSlots.length;
  const sm = qualThirds.length;
  const adj: boolean[][] = thirdSlots.map((s) => qualThirds.map((t) => (s.groups as readonly string[]).includes(t.g)));
  const matchR: number[] = Array(sm).fill(-1);

  function augment(slotIdx: number, visited: boolean[]): boolean {
    for (let j = 0; j < sm; j++) {
      if (adj[slotIdx][j] && !visited[j]) {
        visited[j] = true;
        if (matchR[j] === -1 || augment(matchR[j], visited)) { matchR[j] = slotIdx; return true; }
      }
    }
    return false;
  }
  for (let i = 0; i < sn; i++) augment(i, Array(sm).fill(false));

  const matchL: number[] = Array(sn).fill(-1);
  for (let j = 0; j < sm; j++) { if (matchR[j] >= 0) matchL[matchR[j]] = j; }

  const thirdAssignment: Record<string, string | null> = {};
  for (let i = 0; i < sn; i++) {
    thirdAssignment[thirdSlots[i].matchId] = matchL[i] >= 0 ? qualThirds[matchL[i]].team : null;
  }

  const r32: { id: string; team1: string | null; team2: string | null; winner: string | null }[] = [];
  for (const spec of R32_SPEC) {
    const getTeam = (s: { k: string; g?: string }): string | null => {
      if (s.k === "winner") return byGroup[s.g!]?.winner ?? null;
      if (s.k === "runner") return byGroup[s.g!]?.runner ?? null;
      if (s.k === "third") return thirdAssignment[spec.id] ?? null;
      return null;
    };
    r32.push({ id: spec.id, team1: getTeam(spec.s1), team2: getTeam(spec.s2), winner: picks[spec.id] ?? null });
  }

  const matchById: Record<string, { id: string; team1: string | null; team2: string | null; winner: string | null }> = {};
  for (const bm of r32) matchById[bm.id] = bm;

  const buildNext = (prevIds: string[], nextIds: string[]) => {
    for (let i = 0; i < nextIds.length; i++) {
      const a = matchById[prevIds[i * 2]];
      const b = matchById[prevIds[i * 2 + 1]];
      const id = nextIds[i];
      const bm = { id, team1: a?.winner ?? null, team2: b?.winner ?? null, winner: picks[id] ?? null };
      if (bm.winner && bm.winner !== bm.team1 && bm.winner !== bm.team2) bm.winner = null;
      matchById[id] = bm;
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
    // Don't process anything before the tournament starts (June 11 2026)
    const tournamentStart = new Date("2026-06-11T00:00:00Z");
    if (new Date() < tournamentStart) {
      return json({ ok: true, reason: "tournament_not_started", skipped: true });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── 1. Fetch group standings ──────────────────────────────────────────
    const { data: standingsData, remaining } = await apiFetch(
      "/competitions/WC/standings?season=2026",
    );

    if (remaining < 2) {
      return json({ ok: false, reason: "rate_limited" }, 429);
    }

    // ── 2. Fetch all matches (needed for KO stage resolution) ────────────────
    const { data: matchesData } = await apiFetch(
      "/competitions/WC/matches?season=2026",
    );

    // Always use the API's current standings for all 12 groups.
    // The API updates standings dynamically as matches are played,
    // so this naturally reflects live results without any hardcoding.
    const groupRankings: Record<string, string[]> = {};

    for (const standing of standingsData.standings ?? []) {
      const letter = (standing.group as string)?.replace("GROUP_", "");
      if (!GROUP_LETTERS.includes(letter)) continue;
      const sorted = [...standing.table]
        .sort((a: any, b: any) => a.position - b.position)
        .slice(0, 4)
        .map((row: any) => normalize(row.team.name));
      if (sorted.length === 4) groupRankings[letter] = sorted;
    }

    // Build actual group-stage pts map so third-place team selection is based on
    // real performance (not an alphabetical fallback).
    const teamActualPts: Record<string, number> = {};
    for (const standing of standingsData.standings ?? []) {
      for (const row of (standing.table ?? []) as any[]) {
        const name = normalize(row.team?.name ?? "");
        if (name) teamActualPts[name] = row.points ?? 0;
      }
    }

    const KO_STAGES = new Set([
      "LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL",
    ]);

    // Build matchIdByTeams + knockoutResults iteratively.
    // Each pass uses known results as bracket picks so that later-round team
    // pairings (R16, QF, SF, Final) are resolved correctly.
    // Without this, only R32 matchups would ever be matched — R16+ results
    // would silently be skipped and no KO points past R32 would be awarded.
    const knockoutResults: Record<string, string> = {};
    const matchIdByTeams: Record<string, string> = {};

    for (let pass = 0; pass < 5; pass++) {
      // Rebuild bracket each pass using latest known KO results as picks
      const bracketMatches = buildBracket(groupRankings, knockoutResults, teamActualPts);
      for (const m of bracketMatches) {
        if (m.team1 && m.team2) {
          matchIdByTeams[`${m.team1}|${m.team2}`] = m.id;
          matchIdByTeams[`${m.team2}|${m.team1}`] = m.id;
        }
      }
      // Process all finished KO matches — new matchIds unlock each pass
      for (const match of matchesData.matches ?? []) {
        if (!KO_STAGES.has(match.stage)) continue;
        if (match.status !== "FINISHED") continue;
        if (!match.score?.winner) continue;
        const home = normalize(match.homeTeam.name);
        const away = normalize(match.awayTeam.name);
        const winner = match.score.winner === "HOME_TEAM" ? home : away;
        const matchId = matchIdByTeams[`${home}|${away}`] ?? matchIdByTeams[`${away}|${home}`];
        if (matchId) knockoutResults[matchId] = winner;
      }
    }

    // ── 3. Upsert actual_results ──────────────────────────────────────────
    await supabase.from("actual_results").delete().neq("id", -1);
    const { error: insErr } = await supabase.from("actual_results").insert({
      group_rankings_actual: groupRankings,
      knockout_results_actual: knockoutResults,
    });
    if (insErr) throw new Error(insErr.message);

    // ── 4. Recalculate all users' points ──────────────────────────────────
    const { data: predictions } = await supabase
      .from("predictions")
      .select("id, group_rankings, knockout_picks");

    let updated = 0;
    for (const row of predictions ?? []) {
      const pts = calcPoints(
        row.group_rankings,
        row.knockout_picks,
        groupRankings,
        knockoutResults,
      );
      await supabase.from("predictions").update({ points: pts }).eq("id", row.id);
      updated++;
    }

    // ── 5. Resolve score bets for finished matches ────────────────────────
    // Build a map of matchId → { homeScore, awayScore } for all FINISHED matches
    const finishedScores: Record<number, { homeScore: number; awayScore: number }> = {};
    for (const m of matchesData.matches ?? []) {
      if (m.status !== "FINISHED") continue;
      if (m.score?.fullTime?.home == null || m.score?.fullTime?.away == null) continue;
      finishedScores[m.id as number] = {
        homeScore: m.score.fullTime.home as number,
        awayScore: m.score.fullTime.away as number,
      };
    }

    const { data: unresolvedBets } = await supabase
      .from("bets")
      .select("id, match_id, home_score, away_score")
      .eq("resolved", false);

    let betsResolved = 0;
    for (const bet of unresolvedBets ?? []) {
      const actual = finishedScores[bet.match_id as number];
      if (!actual) continue; // match not finished yet — skip

      let pts = 0;
      const exactScore =
        (bet.home_score as number) === actual.homeScore &&
        (bet.away_score as number) === actual.awayScore;

      if (exactScore) {
        pts = 3;
      } else {
        const actualOutcome =
          actual.homeScore > actual.awayScore ? "HOME" :
          actual.homeScore < actual.awayScore ? "AWAY" : "DRAW";
        const betOutcome =
          (bet.home_score as number) > (bet.away_score as number) ? "HOME" :
          (bet.home_score as number) < (bet.away_score as number) ? "AWAY" : "DRAW";
        if (actualOutcome === betOutcome) pts = 1;
      }

      await supabase.from("bets").update({ points: pts, resolved: true }).eq("id", bet.id);
      betsResolved++;
    }

    return json({
      ok: true,
      groupsResolved: Object.keys(groupRankings).length,
      knockoutResultsCount: Object.keys(knockoutResults).length,
      usersUpdated: updated,
      betsResolved,
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

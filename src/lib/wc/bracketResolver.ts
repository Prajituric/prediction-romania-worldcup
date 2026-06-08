import {
  GROUPS,
  GROUP_LETTERS,
  POSITION_POINTS,
  R32_IDS,
  R16_IDS,
  QF_IDS,
  SF_IDS,
  FINAL_ID,
  type GroupRankings,
  type KnockoutPicks,
} from "./groupsData";

export interface QualifiedTeam {
  team: string;
  group: string;
  position: 1 | 2 | 3;
  points: number;
}

// Spec: 3rd-place slot picker — among allowed groups, highest implied points; alphabetical tie-break.
// For the 16th match runner-up slot: highest remaining runner-up among unplaced groups.

interface R32SlotSpec {
  id: string;
  slot1:
    | { kind: "winner"; group: string }
    | { kind: "runner"; group: string }
    | { kind: "third"; groups: string[] }
    | { kind: "bestThird" }
    | { kind: "remainingRunner" };
  slot2:
    | { kind: "winner"; group: string }
    | { kind: "runner"; group: string }
    | { kind: "third"; groups: string[] }
    | { kind: "bestThird" }
    | { kind: "remainingRunner" };
}

// Official FIFA 2026 Round-of-32 pairings as specified
export const R32_SPEC: R32SlotSpec[] = [
  { id: "R32_1", slot1: { kind: "winner", group: "A" }, slot2: { kind: "third", groups: ["C", "D", "E"] } },
  { id: "R32_2", slot1: { kind: "winner", group: "B" }, slot2: { kind: "runner", group: "F" } },
  { id: "R32_3", slot1: { kind: "winner", group: "C" }, slot2: { kind: "third", groups: ["A", "B", "F"] } },
  { id: "R32_4", slot1: { kind: "winner", group: "D" }, slot2: { kind: "runner", group: "E" } },
  { id: "R32_5", slot1: { kind: "winner", group: "E" }, slot2: { kind: "third", groups: ["D", "E", "F"] } },
  { id: "R32_6", slot1: { kind: "winner", group: "F" }, slot2: { kind: "runner", group: "D" } },
  { id: "R32_7", slot1: { kind: "winner", group: "G" }, slot2: { kind: "third", groups: ["G", "H", "I"] } },
  { id: "R32_8", slot1: { kind: "winner", group: "H" }, slot2: { kind: "runner", group: "I" } },
  { id: "R32_9", slot1: { kind: "winner", group: "I" }, slot2: { kind: "third", groups: ["H", "I", "J"] } },
  { id: "R32_10", slot1: { kind: "winner", group: "J" }, slot2: { kind: "runner", group: "K" } },
  { id: "R32_11", slot1: { kind: "winner", group: "K" }, slot2: { kind: "third", groups: ["J", "K", "L"] } },
  { id: "R32_12", slot1: { kind: "winner", group: "L" }, slot2: { kind: "runner", group: "G" } },
  { id: "R32_13", slot1: { kind: "runner", group: "A" }, slot2: { kind: "runner", group: "B" } },
  { id: "R32_14", slot1: { kind: "runner", group: "C" }, slot2: { kind: "runner", group: "H" } },
  { id: "R32_15", slot1: { kind: "runner", group: "J" }, slot2: { kind: "runner", group: "L" } },
  { id: "R32_16", slot1: { kind: "bestThird" }, slot2: { kind: "remainingRunner" } },
];

export function getQualifiedTeams(rankings: GroupRankings): {
  byGroup: Record<string, { winner: QualifiedTeam; runner: QualifiedTeam; third: QualifiedTeam; fourth: { team: string; group: string } }>;
  allThirds: QualifiedTeam[]; // ranked
  qualifiedThirds: QualifiedTeam[]; // top 8
} {
  const byGroup: Record<string, any> = {};
  const allThirds: QualifiedTeam[] = [];

  for (const g of GROUP_LETTERS) {
    const order = rankings[g];
    if (!order || order.length !== 4) {
      byGroup[g] = null;
      continue;
    }
    const winner: QualifiedTeam = { team: order[0], group: g, position: 1, points: POSITION_POINTS[1] };
    const runner: QualifiedTeam = { team: order[1], group: g, position: 2, points: POSITION_POINTS[2] };
    const third: QualifiedTeam = { team: order[2], group: g, position: 3, points: POSITION_POINTS[3] };
    const fourth = { team: order[3], group: g };
    byGroup[g] = { winner, runner, third, fourth };
    allThirds.push(third);
  }

  const sortedThirds = [...allThirds].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.team.localeCompare(b.team);
  });
  const qualifiedThirds = sortedThirds.slice(0, 8);

  return { byGroup, allThirds: sortedThirds, qualifiedThirds };
}

export interface ResolvedR32Match {
  id: string;
  team1: string | null;
  team2: string | null;
  label1: string; // e.g. "1A"
  label2: string;
}

export function resolveR32(rankings: GroupRankings): ResolvedR32Match[] {
  const { byGroup, qualifiedThirds } = getQualifiedTeams(rankings);
  const qualifiedThirdSet = new Set(qualifiedThirds.map((t) => t.group));

  // Available pools
  const thirdsByGroup: Record<string, QualifiedTeam | undefined> = {};
  for (const t of qualifiedThirds) thirdsByGroup[t.group] = t;

  const usedTeams = new Set<string>();
  const matches: ResolvedR32Match[] = [];

  const pickThirdFromGroups = (groups: string[]): QualifiedTeam | undefined => {
    const candidates = groups
      .filter((g) => qualifiedThirdSet.has(g) && thirdsByGroup[g] && !usedTeams.has(thirdsByGroup[g]!.team))
      .map((g) => thirdsByGroup[g]!);
    candidates.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.team.localeCompare(b.team);
    });
    return candidates[0];
  };

  const resolveSlot = (
    spec: R32SlotSpec["slot1"],
    contextMatches: ResolvedR32Match[],
  ): { team: string | null; label: string } => {
    if (spec.kind === "winner") {
      const t = byGroup[spec.group]?.winner;
      if (t && !usedTeams.has(t.team)) {
        usedTeams.add(t.team);
        return { team: t.team, label: `1${spec.group}` };
      }
      return { team: null, label: `1${spec.group}` };
    }
    if (spec.kind === "runner") {
      const t = byGroup[spec.group]?.runner;
      if (t && !usedTeams.has(t.team)) {
        usedTeams.add(t.team);
        return { team: t.team, label: `2${spec.group}` };
      }
      return { team: null, label: `2${spec.group}` };
    }
    if (spec.kind === "third") {
      const t = pickThirdFromGroups(spec.groups);
      const label = `3${spec.groups.join("/")}`;
      if (t) {
        usedTeams.add(t.team);
        return { team: t.team, label };
      }
      return { team: null, label };
    }
    if (spec.kind === "bestThird") {
      // any qualified third not yet used
      const remaining = qualifiedThirds.filter((t) => !usedTeams.has(t.team));
      remaining.sort((a, b) => (b.points - a.points) || a.team.localeCompare(b.team));
      const t = remaining[0];
      if (t) {
        usedTeams.add(t.team);
        return { team: t.team, label: "Best 3rd" };
      }
      return { team: null, label: "Best 3rd" };
    }
    if (spec.kind === "remainingRunner") {
      // Try a runner-up first; if none remain (all 12 are placed in R32_1..R32_15),
      // fall back to the next-best remaining qualified team (a 3rd-place team).
      const remainingRunners = GROUP_LETTERS
        .map((g) => byGroup[g]?.runner as QualifiedTeam | undefined)
        .filter((t): t is QualifiedTeam => !!t && !usedTeams.has(t.team));
      if (remainingRunners.length > 0) {
        remainingRunners.sort((a, b) => a.team.localeCompare(b.team));
        const t = remainingRunners[0];
        usedTeams.add(t.team);
        return { team: t.team, label: "Remaining 2nd" };
      }
      const remainingThirds = qualifiedThirds.filter((t) => !usedTeams.has(t.team));
      remainingThirds.sort((a, b) => (b.points - a.points) || a.team.localeCompare(b.team));
      const t = remainingThirds[0];
      if (t) {
        usedTeams.add(t.team);
        return { team: t.team, label: "Best remaining 3rd" };
      }
      return { team: null, label: "Remaining 2nd" };
    }
    return { team: null, label: "?" };
  };

  for (const spec of R32_SPEC) {
    const s1 = resolveSlot(spec.slot1, matches);
    const s2 = resolveSlot(spec.slot2, matches);
    matches.push({
      id: spec.id,
      team1: s1.team,
      team2: s2.team,
      label1: s1.label,
      label2: s2.label,
    });
  }

  return matches;
}

export interface BracketMatch {
  id: string;
  round: "R32" | "R16" | "QF" | "SF" | "F";
  team1: string | null;
  team2: string | null;
  label1: string;
  label2: string;
  winner: string | null;
}

export function buildFullBracket(
  rankings: GroupRankings,
  picks: KnockoutPicks,
): BracketMatch[] {
  const r32Resolved = resolveR32(rankings);
  const matches: BracketMatch[] = r32Resolved.map((m) => ({
    id: m.id,
    round: "R32",
    team1: m.team1,
    team2: m.team2,
    label1: m.label1,
    label2: m.label2,
    winner: picks[m.id] ?? null,
  }));

  const matchById: Record<string, BracketMatch> = {};
  for (const m of matches) matchById[m.id] = m;

  const buildNext = (
    prevIds: string[],
    nextIds: string[],
    round: BracketMatch["round"],
  ) => {
    for (let i = 0; i < nextIds.length; i++) {
      const a = matchById[prevIds[i * 2]];
      const b = matchById[prevIds[i * 2 + 1]];
      const id = nextIds[i];
      const m: BracketMatch = {
        id,
        round,
        team1: a?.winner ?? null,
        team2: b?.winner ?? null,
        label1: `W ${a?.id ?? ""}`,
        label2: `W ${b?.id ?? ""}`,
        winner: picks[id] ?? null,
      };
      // sanity: if a pick exists but team isn't one of the two available teams, ignore it
      if (m.winner && m.winner !== m.team1 && m.winner !== m.team2) {
        m.winner = null;
      }
      matches.push(m);
      matchById[id] = m;
    }
  };

  buildNext(R32_IDS, R16_IDS, "R16");
  buildNext(R16_IDS, QF_IDS, "QF");
  buildNext(QF_IDS, SF_IDS, "SF");
  buildNext(SF_IDS, [FINAL_ID], "F");

  return matches;
}

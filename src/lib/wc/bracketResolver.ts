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

interface R32SlotSpec {
  id: string;
  slot1:
    | { kind: "winner"; group: string }
    | { kind: "runner"; group: string }
    | { kind: "third"; groups: string[] };
  slot2:
    | { kind: "winner"; group: string }
    | { kind: "runner"; group: string }
    | { kind: "third"; groups: string[] };
}

// Official FIFA 2026 Round-of-32 pairings
export const R32_SPEC: R32SlotSpec[] = [
  { id: "R32_1",  slot1: { kind: "runner", group: "A" }, slot2: { kind: "runner", group: "B" } },
  { id: "R32_2",  slot1: { kind: "winner", group: "F" }, slot2: { kind: "runner", group: "C" } },
  { id: "R32_3",  slot1: { kind: "winner", group: "C" }, slot2: { kind: "runner", group: "F" } },
  { id: "R32_4",  slot1: { kind: "winner", group: "E" }, slot2: { kind: "third", groups: ["A","B","C","D","F"] } },
  { id: "R32_5",  slot1: { kind: "runner", group: "E" }, slot2: { kind: "runner", group: "I" } },
  { id: "R32_6",  slot1: { kind: "winner", group: "A" }, slot2: { kind: "third", groups: ["C","E","F","H","I"] } },
  { id: "R32_7",  slot1: { kind: "runner", group: "D" }, slot2: { kind: "runner", group: "G" } },
  { id: "R32_8",  slot1: { kind: "winner", group: "D" }, slot2: { kind: "third", groups: ["B","E","F","I","J"] } },
  { id: "R32_9",  slot1: { kind: "winner", group: "I" }, slot2: { kind: "third", groups: ["C","D","F","G","H"] } },
  { id: "R32_10", slot1: { kind: "winner", group: "K" }, slot2: { kind: "third", groups: ["D","E","I","J","L"] } },
  { id: "R32_11", slot1: { kind: "runner", group: "K" }, slot2: { kind: "runner", group: "L" } },
  { id: "R32_12", slot1: { kind: "winner", group: "G" }, slot2: { kind: "third", groups: ["A","E","H","I","J"] } },
  { id: "R32_13", slot1: { kind: "winner", group: "B" }, slot2: { kind: "third", groups: ["E","F","G","I","J"] } },
  { id: "R32_14", slot1: { kind: "winner", group: "H" }, slot2: { kind: "runner", group: "J" } },
  { id: "R32_15", slot1: { kind: "winner", group: "J" }, slot2: { kind: "runner", group: "H" } },
  { id: "R32_16", slot1: { kind: "winner", group: "L" }, slot2: { kind: "third", groups: ["E","H","I","J","K"] } },
];

export function getQualifiedTeams(rankings: GroupRankings): {
  byGroup: Record<string, { winner: QualifiedTeam; runner: QualifiedTeam; third: QualifiedTeam; fourth: { team: string; group: string } }>;
  allThirds: QualifiedTeam[];
  qualifiedThirds: QualifiedTeam[];
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
    const third: QualifiedTeam  = { team: order[2], group: g, position: 3, points: POSITION_POINTS[3] };
    const fourth = { team: order[3], group: g };
    byGroup[g] = { winner, runner, third, fourth };
    allThirds.push(third);
  }

  const sortedThirds = [...allThirds].sort((a, b) =>
    b.points !== a.points ? b.points - a.points : a.team.localeCompare(b.team)
  );
  const qualifiedThirds = sortedThirds.slice(0, 8);

  return { byGroup, allThirds: sortedThirds, qualifiedThirds };
}

/**
 * Bipartite matching (augmenting paths) to assign each qualified third-place
 * team to exactly one R32 slot whose group pool contains that team's group.
 * This avoids the greedy collision where the same group (e.g. H) is eligible
 * for multiple slots but should fill only one.
 *
 * Returns a map: matchId -> team name for that slot.
 */
function matchThirdsToSlots(
  slots: Array<{ matchId: string; groups: string[] }>,
  thirds: QualifiedTeam[],
): Record<string, string | null> {
  const n = slots.length;
  const m = thirds.length;

  // adj[i][j] = slot i can accept third j
  const adj: boolean[][] = slots.map((s) =>
    thirds.map((t) => s.groups.includes(t.group))
  );

  // matchR[j] = which slot index is matched to third j (-1 = unmatched)
  const matchR: number[] = Array(m).fill(-1);

  function augment(slotIdx: number, visited: boolean[]): boolean {
    for (let j = 0; j < m; j++) {
      if (adj[slotIdx][j] && !visited[j]) {
        visited[j] = true;
        if (matchR[j] === -1 || augment(matchR[j], visited)) {
          matchR[j] = slotIdx;
          return true;
        }
      }
    }
    return false;
  }

  // Run augmentation for each slot
  for (let i = 0; i < n; i++) {
    const visited = Array(m).fill(false);
    augment(i, visited);
  }

  // Build matchL AFTER all augmentations (matchR may be reassigned during path augmentation)
  const matchL: number[] = Array(n).fill(-1);
  for (let j = 0; j < m; j++) {
    if (matchR[j] >= 0) matchL[matchR[j]] = j;
  }

  const result: Record<string, string | null> = {};
  for (let i = 0; i < n; i++) {
    result[slots[i].matchId] = matchL[i] >= 0 ? thirds[matchL[i]].team : null;
  }
  return result;
}

export interface ResolvedR32Match {
  id: string;
  team1: string | null;
  team2: string | null;
  label1: string;
  label2: string;
}

export function resolveR32(rankings: GroupRankings, selectedThirds?: string[]): ResolvedR32Match[] {
  const { byGroup, allThirds, qualifiedThirds: autoQualified } = getQualifiedTeams(rankings);

  const qualifiedThirds =
    selectedThirds && selectedThirds.length === 8
      ? allThirds.filter((t) => selectedThirds.includes(t.team))
      : autoQualified;

  // Collect all "third" slots and run bipartite matching
  const thirdSlots: Array<{ matchId: string; groups: string[] }> = [];
  for (const spec of R32_SPEC) {
    const slot = spec.slot1.kind === "third" ? spec.slot1
                : spec.slot2.kind === "third" ? spec.slot2
                : null;
    if (slot) thirdSlots.push({ matchId: spec.id, groups: slot.groups });
  }
  const thirdAssignment = matchThirdsToSlots(thirdSlots, qualifiedThirds);

  // Resolve matches
  const matches: ResolvedR32Match[] = [];
  for (const spec of R32_SPEC) {
    const resolve = (slot: R32SlotSpec["slot1"]): { team: string | null; label: string } => {
      if (slot.kind === "winner") {
        return { team: byGroup[slot.group]?.winner?.team ?? null, label: `1${slot.group}` };
      }
      if (slot.kind === "runner") {
        return { team: byGroup[slot.group]?.runner?.team ?? null, label: `2${slot.group}` };
      }
      // kind === "third"
      const team = thirdAssignment[spec.id] ?? null;
      return { team, label: "Best 3rd" };
    };

    const s1 = resolve(spec.slot1);
    const s2 = resolve(spec.slot2);
    matches.push({ id: spec.id, team1: s1.team, team2: s2.team, label1: s1.label, label2: s2.label });
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
  selectedThirds?: string[],
): BracketMatch[] {
  const r32Resolved = resolveR32(rankings, selectedThirds);
  const matches: BracketMatch[] = r32Resolved.map((m) => ({
    id: m.id,
    round: "R32" as const,
    team1: m.team1,
    team2: m.team2,
    label1: m.label1,
    label2: m.label2,
    winner: picks[m.id] ?? null,
  }));

  const matchById: Record<string, BracketMatch> = {};
  for (const m of matches) matchById[m.id] = m;

  const buildNext = (prevIds: string[], nextIds: string[], round: BracketMatch["round"]) => {
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
      if (m.winner && m.winner !== m.team1 && m.winner !== m.team2) m.winner = null;
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

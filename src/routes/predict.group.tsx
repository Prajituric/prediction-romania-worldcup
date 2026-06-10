import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { GROUPS, GROUP_LETTERS } from "@/lib/wc/groupsData";
import { getUser, loadGroups, saveGroups, isSubmitted } from "@/lib/wc/session";
import { getActualResults } from "@/lib/wc/predictions.functions";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { X } from "lucide-react";
import { getFlag } from "@/lib/wc/flags";

export const Route = createFileRoute("/predict/group")({
  head: () => ({
    meta: [
      { title: "Group Stage — Rank the 12 Groups" },
      { name: "description", content: "Rank each of the 12 World Cup 2026 groups from 1st to 4th to qualify your bracket." },
    ],
  }),
  component: GroupPredict,
});

// Per-group ordered ranking (only the teams the user has clicked so far).
type Rankings = Record<string, string[]>;

function GroupPredict() {
  const navigate = useNavigate();
  const [user, setUserState] = useState<ReturnType<typeof getUser>>(null);
  // ranked[group] is the click-order list (length 0..4)
  const [ranked, setRanked] = useState<Rankings>({});
  const [locked, setLocked] = useState(false);
  const fetchActual = useServerFn(getActualResults);

  const { data: actual } = useQuery({
    queryKey: ["actual-results"],
    queryFn: () => fetchActual(),
    enabled: locked,
    refetchInterval: locked ? 3 * 60 * 1000 : false,
  });

  // When locked + actual results exist, show actual standings instead of user picks
  const displayRanked = useMemo<Rankings>(() => {
    if (locked && actual?.groupRankings && Object.keys(actual.groupRankings).length > 0) {
      return actual.groupRankings as Rankings;
    }
    return ranked;
  }, [locked, actual, ranked]);

  const showingActual = locked && !!actual?.groupRankings && Object.keys(actual.groupRankings).length > 0;

  useEffect(() => {
    const u = getUser();
    if (!u) { navigate({ to: "/" }); return; }
    setUserState(u);
    setLocked(isSubmitted());
    const saved = loadGroups();
    if (saved && Object.keys(saved).length === 12) {
      // Saved is always full 4-team order. Treat as fully ranked.
      setRanked(saved);
    } else {
      const empty: Rankings = {};
      for (const g of GROUP_LETTERS) empty[g] = [];
      setRanked(empty);
    }
  }, [navigate]);

  // Persist whenever a group is fully ranked (4/4) so the bracket can read it.
  // We persist a full-ordered map: for partially-ranked groups, append the
  // remaining default-order teams so bracket logic always has 4 entries.
  const persist = (next: Rankings) => {
    const full: Rankings = {};
    for (const g of GROUP_LETTERS) {
      const picked = next[g] ?? [];
      const remaining = GROUPS[g].filter((t) => !picked.includes(t));
      full[g] = [...picked, ...remaining];
    }
    saveGroups(full);
  };

  const clickTeam = (g: string, team: string) => {
    if (locked) return;
    const current = ranked[g] ?? [];
    let nextList: string[];
    if (current.includes(team)) {
      // Un-rank this team (and shift later picks up — they keep their relative order)
      nextList = current.filter((t) => t !== team);
    } else {
      if (current.length >= 4) return;
      nextList = [...current, team];
      // If 3 are ranked, auto-assign the last remaining team as 4th
      if (nextList.length === 3) {
        const last = GROUPS[g].find((t) => !nextList.includes(t));
        if (last) nextList.push(last);
      }
    }
    const next = { ...ranked, [g]: nextList };
    setRanked(next);
    persist(next);
  };

  const clearGroup = (g: string) => {
    if (locked) return;
    const next = { ...ranked, [g]: [] };
    setRanked(next);
    persist(next);
  };

  const allDone = useMemo(
    () => GROUP_LETTERS.every((g) => (ranked[g]?.length ?? 0) === 4),
    [ranked],
  );

  const continueNext = () => navigate({ to: "/predict/thirds" });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight uppercase">Predict the Group Stage</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Click teams in order to rank them 1st to 4th. Top 2 advance, best 3rd-place teams also qualify.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Hi <span className="text-foreground font-medium">{user.name}</span>
          </p>
        </div>

        {locked && (
          <div className="mb-4 p-3 rounded-md border border-primary/40 bg-primary/5 text-sm text-center">
            {showingActual
              ? "🏆 Showing actual group standings as they develop"
              : "🔒 Your predictions have been submitted. Actual standings will appear once matches begin."}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GROUP_LETTERS.map((g) => {
            const picks = displayRanked[g] ?? [];
            const done = picks.length === 4;
            return (
              <div key={g} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
                  <h2 className="text-xs font-bold tracking-widest text-muted-foreground">GROUP {g}</h2>
                  {done ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-wider text-primary">DONE</span>
                      {!locked && (
                        <button
                          onClick={() => clearGroup(g)}
                          className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                          aria-label="Clear group"
                          title="Clear picks"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{picks.length}/4</span>
                  )}
                </div>
                <ul className="p-2 space-y-1.5">
                  {[...picks, ...GROUPS[g].filter((t) => !picks.includes(t))].map((team) => {
                    const idx = picks.indexOf(team);
                    // When showing actual results, mark unresolved spots as pending
                    const isPending = showingActual && !picks.includes(team);
                    const isRanked = idx >= 0;
                    const isFourthAuto = isRanked && idx === 3;
                    return (
                      <li key={team}>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => clickTeam(g, team)}
                          className={[
                            "w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition border",
                            isRanked
                              ? isFourthAuto
                                ? "bg-secondary/40 border-border text-muted-foreground"
                                : "bg-secondary/70 border-primary/40 text-foreground font-medium"
                              : "bg-transparent border-transparent hover:bg-accent text-foreground/80",
                            locked ? "cursor-not-allowed" : "cursor-pointer",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0",
                              isRanked
                                ? idx === 0
                                  ? "bg-primary text-primary-foreground"
                                  : idx === 1
                                  ? "bg-secondary text-foreground border border-border"
                                  : idx === 2
                                  ? "bg-secondary text-foreground border border-border"
                                  : "bg-muted text-muted-foreground"
                                : "border border-border text-muted-foreground",
                            ].join(" ")}
                          >
                            {isRanked ? idx + 1 : ""}
                          </span>
                          {(() => { const f = getFlag(team); return f ? <span className={`fi fi-${f} shrink-0`} /> : null; })()}
                          <span className="flex-1 text-left uppercase tracking-wide text-[13px]">{team}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={continueNext}
            disabled={!allDone && !locked}
            className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={!allDone ? "Rank all 12 groups first" : ""}
          >
            Continue to thirds →
          </button>
        </div>
      </main>
    </div>
  );
}

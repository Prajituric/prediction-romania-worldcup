import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GROUP_LETTERS } from "@/lib/wc/groupsData";
import { getUser, isSubmitted, loadGroups, loadThirds, saveThirds } from "@/lib/wc/session";
import { getActualResults } from "@/lib/wc/predictions.functions";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { getFlag } from "@/lib/wc/flags";

export const Route = createFileRoute("/predict/thirds")({
  head: () => ({
    meta: [
      { title: "Third-Place Finishers — Pick Your 8" },
      { name: "description", content: "Select the 8 best third-place teams you think will advance to the Round of 32." },
    ],
  }),
  component: ThirdsPredict,
});

function ThirdsPredict() {
  const navigate = useNavigate();
  const fetchActual = useServerFn(getActualResults);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [locked, setLocked] = useState(false);
  const [thirdsFromGroups, setThirdsFromGroups] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: actual } = useQuery({
    queryKey: ["actual-results"],
    queryFn: () => fetchActual(),
    enabled: locked,
  });

  useEffect(() => {
    const u = getUser();
    if (!u) { navigate({ to: "/" }); return; }
    setUser(u);

    const submitted = isSubmitted();
    setLocked(submitted);

    const groups = loadGroups();
    const thirds: Record<string, string> = {};
    for (const g of GROUP_LETTERS) {
      const team = groups[g]?.[2];
      if (team) thirds[g] = team;
    }
    setThirdsFromGroups(thirds);

    const saved = loadThirds();
    if (saved && saved.length > 0) setSelected(new Set(saved));
  }, [navigate]);

  // Always show user's own predicted thirds (so checkmarks work correctly).
  // Actual 3rd-place teams are shown as a comparison indicator per row.
  const displayThirds = thirdsFromGroups;

  // Actual 3rd-place team per group (for comparison when locked)
  const actualThirds = useMemo<Record<string, string>>(() => {
    if (!actual?.groupRankings || Object.keys(actual.groupRankings).length === 0) return {};
    const result: Record<string, string> = {};
    for (const g of GROUP_LETTERS) {
      const team = (actual.groupRankings as Record<string, string[]>)[g]?.[2];
      if (team) result[g] = team;
    }
    return result;
  }, [actual]);

  const toggle = (team: string) => {
    if (locked) return;
    const next = new Set(selected);
    if (next.has(team)) {
      next.delete(team);
    } else {
      if (next.size >= 8) return;
      next.add(team);
    }
    setSelected(next);
    saveThirds([...next]);
  };

  const canContinue = selected.size === 8 || locked;
  const hasActualData = Object.keys(actualThirds).length > 0;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight uppercase">Third-Place Finishers</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Pick the 8 best third-place teams you think will advance to the Round of 32
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Hi <span className="text-foreground font-medium">{user.name}</span>
          </p>
        </div>

        {locked && (
          <div className="mb-4 p-3 rounded-md border border-primary/40 bg-primary/5 text-sm text-center">
            {hasActualData
              ? "🏆 Your picks are shown. Actual results appear on the right as groups complete."
              : "🔒 Your picks are locked. Actual standings will appear once groups finish."}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
            <span className="text-sm font-bold">{selected.size}/8 selected</span>
            {selected.size === 8 && (
              <span className="text-xs text-primary font-semibold">All 8 picked ✓</span>
            )}
          </div>
          <ul className="p-2 space-y-1.5">
            {GROUP_LETTERS.map((g) => {
              const team = displayThirds[g] ?? null;
              const isSelected = team ? selected.has(team) : false;
              const maxReached = !isSelected && selected.size >= 8;
              const flag = team ? getFlag(team) : null;
              // Actual 3rd-place comparison
              const actualTeam = actualThirds[g] ?? null;
              const actualMatches = actualTeam && actualTeam === team;
              const actualFlag = actualTeam ? getFlag(actualTeam) : null;

              return (
                <li key={g}>
                  <button
                    type="button"
                    disabled={locked || !team || maxReached}
                    onClick={() => team && toggle(team)}
                    className={[
                      "w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition border",
                      isSelected
                        ? "bg-secondary/70 border-primary/40 text-foreground font-medium"
                        : "bg-transparent border-transparent hover:bg-accent text-foreground/80",
                      locked ? "cursor-not-allowed" : (!team || maxReached) ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <span className={[
                      "inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground",
                    ].join(" ")}>
                      {isSelected ? "✓" : ""}
                    </span>
                    {flag
                      ? <span className={`fi fi-${flag} shrink-0`} />
                      : <span className="w-4 shrink-0" />}
                    <span className="flex-1 text-left uppercase tracking-wide text-[13px]">
                      {team ?? (
                        <span className="italic text-muted-foreground normal-case tracking-normal text-xs">
                          Third-place Group {g}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">Group {g}</span>
                    {/* Actual result badge when locked and data exists */}
                    {locked && hasActualData && actualTeam && (
                      <span className={[
                        "ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0",
                        actualMatches
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400",
                      ].join(" ")}>
                        {actualMatches ? "✓" : (
                          <>
                            {actualFlag && <span className={`fi fi-${actualFlag}`} />}
                            <span className="uppercase">{actualTeam}</span>
                          </>
                        )}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex justify-between gap-3">
          <button
            onClick={() => navigate({ to: "/predict/group" })}
            disabled={locked}
            className="px-5 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Back to groups
          </button>
          <button
            onClick={() => navigate({ to: "/predict/bracket" })}
            disabled={!canContinue}
            className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canContinue ? "Select all 8 third-place teams first" : ""}
          >
            Continue to bracket →
          </button>
        </div>
      </main>
    </div>
  );
}

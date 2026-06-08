import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GROUPS, GROUP_LETTERS } from "@/lib/wc/groupsData";
import { getUser, loadGroups, saveGroups, isSubmitted } from "@/lib/wc/session";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { ArrowDown, ArrowUp } from "lucide-react";

export const Route = createFileRoute("/predict/group")({
  head: () => ({
    meta: [
      { title: "Group Stage — Rank the 12 Groups" },
      { name: "description", content: "Rank each of the 12 World Cup 2026 groups from 1st to 4th to qualify your bracket." },
    ],
  }),
  component: GroupPredict,
});

function defaultRankings(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const g of GROUP_LETTERS) out[g] = [...GROUPS[g]];
  return out;
}

function GroupPredict() {
  const navigate = useNavigate();
  const [user, setUserState] = useState<ReturnType<typeof getUser>>(null);
  const [rankings, setRankings] = useState<Record<string, string[]>>(defaultRankings);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { navigate({ to: "/" }); return; }
    setUserState(u);
    setLocked(isSubmitted());
    const saved = loadGroups();
    if (saved && Object.keys(saved).length === 12) setRankings(saved);
  }, [navigate]);

  const move = (g: string, idx: number, dir: -1 | 1) => {
    if (locked) return;
    const arr = [...rankings[g]];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    const next = { ...rankings, [g]: arr };
    setRankings(next);
    saveGroups(next);
  };

  const continueNext = () => {
    saveGroups(rankings);
    navigate({ to: "/predict/bracket" });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Group Stage</h1>
            <p className="text-muted-foreground">Hi <span className="text-foreground font-medium">{user.name}</span> — rank each group 1st to 4th. Top 2 from each group plus 8 best 3rd-place teams advance.</p>
          </div>
          <button onClick={continueNext} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            Continue to bracket →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GROUP_LETTERS.map((g) => (
            <div key={g} className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-semibold mb-3">Group {g}</h2>
              <ol className="space-y-2">
                {rankings[g].map((team, idx) => (
                  <li key={team} className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/40">
                    <span className="text-xs font-mono w-5 text-muted-foreground">{idx + 1}.</span>
                    <span className="flex-1 truncate text-sm">{team}</span>
                    <button
                      onClick={() => move(g, idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-accent disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(g, idx, 1)}
                      disabled={idx === 3}
                      className="p-1 rounded hover:bg-accent disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button onClick={continueNext} className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
            Continue to bracket →
          </button>
        </div>
      </main>
    </div>
  );
}

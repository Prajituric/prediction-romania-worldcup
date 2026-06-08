import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { GROUPS, GROUP_LETTERS, R32_IDS, R16_IDS, QF_IDS, SF_IDS, FINAL_ID } from "@/lib/wc/groupsData";
import { buildFullBracket, type BracketMatch } from "@/lib/wc/bracketResolver";
import { getUser, loadGroups, loadPicks, savePicks, isSubmitted, setSubmitted } from "@/lib/wc/session";
import { savePredictions } from "@/lib/wc/predictions.functions";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/predict/bracket")({
  head: () => ({
    meta: [
      { title: "Knockout Bracket — Predict Every Match" },
      { name: "description", content: "Click your winner in every knockout match from Round of 32 through the Final." },
    ],
  }),
  component: BracketPredict,
});

function BracketPredict() {
  const navigate = useNavigate();
  const save = useServerFn(savePredictions);
  const [user, setUserState] = useState<ReturnType<typeof getUser>>(null);
  const [rankings, setRankings] = useState<Record<string, string[]> | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { navigate({ to: "/" }); return; }
    setUserState(u);
    const g = loadGroups();
    if (!g || Object.keys(g).length !== 12) {
      // initialize defaults from GROUPS
      const def: Record<string, string[]> = {};
      for (const L of GROUP_LETTERS) def[L] = [...GROUPS[L]];
      setRankings(def);
    } else {
      setRankings(g);
    }
    setPicks(loadPicks());
  }, [navigate]);

  const bracket = useMemo<BracketMatch[]>(() => {
    if (!rankings) return [];
    return buildFullBracket(rankings, picks);
  }, [rankings, picks]);

  const matchById = useMemo(() => {
    const m: Record<string, BracketMatch> = {};
    for (const b of bracket) m[b.id] = b;
    return m;
  }, [bracket]);

  const pick = (id: string, team: string | null) => {
    if (!team) return;
    const next = { ...picks, [id]: team };
    // clear downstream picks that referenced the previous winner
    const downstreamMap: Record<string, string> = {};
    const pairs = [
      [R32_IDS, R16_IDS],
      [R16_IDS, QF_IDS],
      [QF_IDS, SF_IDS],
      [SF_IDS, [FINAL_ID]],
    ] as const;
    for (const [src, dst] of pairs) {
      for (let i = 0; i < dst.length; i++) {
        downstreamMap[src[i * 2]] = dst[i];
        downstreamMap[src[i * 2 + 1]] = dst[i];
      }
    }
    let cur = id;
    while (downstreamMap[cur]) {
      const child = downstreamMap[cur];
      if (next[child]) delete next[child];
      cur = child;
    }
    setPicks(next);
    savePicks(next);
  };

  const resetAll = () => {
    if (!confirm("Clear all knockout picks?")) return;
    setPicks({});
    savePicks({});
  };

  const submit = async () => {
    if (!user || !rankings) return;
    setSubmitting(true);
    try {
      const res = await save({ data: { userId: user.userId, groupRankings: rankings, knockoutPicks: picks } });
      toast.success(`Predictions saved! Current points: ${res.points}`);
      navigate({ to: "/leaderboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save predictions.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || !rankings) return null;

  const champion = matchById[FINAL_ID]?.winner ?? null;

  const renderColumn = (ids: string[], title: string) => (
    <div className="flex flex-col gap-3 min-w-[200px]">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{title}</h3>
      <div className="flex flex-col justify-around flex-1 gap-3">
        {ids.map((id) => {
          const m = matchById[id];
          if (!m) return null;
          return <MatchCard key={id} match={m} onPick={(team) => pick(id, team)} />;
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Knockout Bracket</h1>
            <p className="text-muted-foreground">Click a team to pick the winner. Winners automatically advance.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate({ to: "/predict/group" })} className="px-3 py-2 rounded-md border border-border hover:bg-accent text-sm">← Edit groups</button>
            <button onClick={resetAll} className="px-3 py-2 rounded-md border border-border hover:bg-accent text-sm">Reset all picks</button>
            <button onClick={submit} disabled={submitting} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {submitting ? "Saving…" : "Submit predictions"}
            </button>
          </div>
        </div>

        {champion && (
          <div className="mb-6 p-4 rounded-lg border border-primary/40 bg-primary/5 text-center">
            <div className="text-sm text-muted-foreground">Your predicted champion</div>
            <div className="text-2xl font-bold text-primary">🏆 {champion}</div>
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="flex gap-6 min-w-fit pb-4">
            {renderColumn(R32_IDS, "Round of 32")}
            {renderColumn(R16_IDS, "Round of 16")}
            {renderColumn(QF_IDS, "Quarter-finals")}
            {renderColumn(SF_IDS, "Semi-finals")}
            {renderColumn([FINAL_ID], "Final")}
          </div>
        </div>
      </main>
    </div>
  );
}

function MatchCard({ match, onPick }: { match: BracketMatch; onPick: (team: string) => void }) {
  const row = (team: string | null, label: string) => {
    const disabled = !team;
    const selected = team && match.winner === team;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => team && onPick(team)}
        className={[
          "w-full text-left px-3 py-2 text-sm rounded transition border",
          selected
            ? "bg-primary text-primary-foreground border-primary font-semibold"
            : "bg-card hover:bg-accent border-border",
          disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {team ?? <span className="italic text-muted-foreground">{label}</span>}
      </button>
    );
  };
  return (
    <div className="rounded-lg border border-border bg-card/50 p-2 flex flex-col gap-1.5">
      <div className="text-[10px] text-muted-foreground font-mono px-1">{match.id}</div>
      {row(match.team1, match.label1)}
      {row(match.team2, match.label2)}
    </div>
  );
}

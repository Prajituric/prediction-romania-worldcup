import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { GROUPS, GROUP_LETTERS, R32_IDS, R16_IDS, QF_IDS, SF_IDS, FINAL_ID } from "@/lib/wc/groupsData";
import { buildFullBracket, type BracketMatch } from "@/lib/wc/bracketResolver";
import { getUser, loadGroups, loadPicks, savePicks, isSubmitted, setSubmitted } from "@/lib/wc/session";
import { savePredictions } from "@/lib/wc/predictions.functions";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { toast } from "sonner";
import { Trophy, Check } from "lucide-react";

export const Route = createFileRoute("/predict/bracket")({
  head: () => ({
    meta: [
      { title: "Knockout Bracket — Predict Every Match" },
      { name: "description", content: "Click your winner in every knockout match from Round of 32 through the Final." },
    ],
  }),
  component: BracketPredict,
});

const ROUNDS: { key: "R32" | "R16" | "QF" | "SF" | "F"; label: string; short: string; ids: string[] }[] = [
  { key: "R32", label: "Round of 32", short: "R32", ids: R32_IDS },
  { key: "R16", label: "Round of 16", short: "R16", ids: R16_IDS },
  { key: "QF", label: "Quarter-finals", short: "QF", ids: QF_IDS },
  { key: "SF", label: "Semi-finals", short: "SF", ids: SF_IDS },
  { key: "F", label: "Final", short: "Final", ids: [FINAL_ID] },
];

function BracketPredict() {
  const navigate = useNavigate();
  const save = useServerFn(savePredictions);
  const [user, setUserState] = useState<ReturnType<typeof getUser>>(null);
  const [rankings, setRankings] = useState<Record<string, string[]> | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [activeRound, setActiveRound] = useState<(typeof ROUNDS)[number]["key"]>("R32");

  useEffect(() => {
    const u = getUser();
    if (!u) { navigate({ to: "/" }); return; }
    setUserState(u);
    setLocked(isSubmitted());
    const g = loadGroups();
    if (!g || Object.keys(g).length !== 12) {
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
    if (!team || locked) return;
    const next = { ...picks, [id]: team };
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
    if (locked) return;
    if (!confirm("Clear all knockout picks?")) return;
    setPicks({});
    savePicks({});
  };

  const submit = async () => {
    if (!user || !rankings || locked) return;
    setSubmitting(true);
    try {
      const res = await save({ data: { userId: user.userId, groupRankings: rankings, knockoutPicks: picks } });
      setSubmitted(true);
      setLocked(true);
      toast.success(`Predictions submitted and locked! Current points: ${res.points}`);
      navigate({ to: "/leaderboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save predictions.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || !rankings) return null;

  const champion = matchById[FINAL_ID]?.winner ?? null;
  const finalMatch = matchById[FINAL_ID];

  const roundProgress = (ids: string[]) => {
    const picked = ids.filter((id) => matchById[id]?.winner).length;
    return { picked, total: ids.length };
  };

  const half = (arr: string[]) => {
    const h = arr.length / 2;
    return [arr.slice(0, h), arr.slice(h)] as const;
  };
  const [r32L, r32R] = half(R32_IDS);
  const [r16L, r16R] = half(R16_IDS);
  const [qfL, qfR] = half(QF_IDS);
  const [sfL, sfR] = [[SF_IDS[0]], [SF_IDS[1]]];

  const renderColumn = (ids: string[], title: string, align: "left" | "right") => (
    <div className="flex flex-col gap-2 min-w-[180px] flex-1">
      <h3
        className={[
          "text-[10px] uppercase tracking-[0.25em] text-primary/80 font-semibold",
          align === "right" ? "text-right" : "text-left",
        ].join(" ")}
      >
        {title}
      </h3>
      <div className="flex flex-col justify-around flex-1 gap-3">
        {ids.map((id) => {
          const m = matchById[id];
          if (!m) return null;
          return <MatchCard key={id} match={m} locked={locked} onPick={(team) => pick(id, team)} />;
        })}
      </div>
    </div>
  );

  const ChampionCard = (
    <div
      className={[
        "w-full rounded-xl border-2 px-5 py-6 text-center transition",
        champion
          ? "border-primary bg-gradient-to-b from-primary/15 to-primary/5 shadow-[0_0_40px_-12px_var(--primary)]"
          : "border-dashed border-border/60 bg-card/40",
      ].join(" ")}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 font-semibold mb-3">Champion</div>
      <div
        className={[
          "text-xl font-extrabold uppercase tracking-wider",
          champion ? "text-primary" : "text-muted-foreground italic",
        ].join(" ")}
      >
        {champion ?? "TBD"}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-5 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-3 mb-5 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Knockout Bracket</h1>
            <p className="text-muted-foreground text-sm">Tap a team to crown the winner. Winners auto-advance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate({ to: "/predict/group" })} className="px-3 py-2 rounded-md border border-border hover:bg-accent text-xs sm:text-sm">{locked ? "← Groups" : "← Edit groups"}</button>
            {!locked && (
              <button onClick={resetAll} className="px-3 py-2 rounded-md border border-border hover:bg-accent text-xs sm:text-sm">Reset</button>
            )}
            {!locked && (
              <button onClick={submit} disabled={submitting} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs sm:text-sm font-semibold">
                {submitting ? "Saving…" : "Submit"}
              </button>
            )}
            {locked && (
              <button onClick={() => navigate({ to: "/leaderboard" })} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm">Leaderboard →</button>
            )}
          </div>
        </div>

        {locked && (
          <div className="mb-5 p-3 rounded-md border border-primary/40 bg-primary/5 text-sm">
            🔒 Your predictions are submitted and locked. Viewing only.
          </div>
        )}

        {/* MOBILE / TABLET — round tabs + stacked cards */}
        <div className="lg:hidden">
          {/* Sticky round tabs */}
          <div className="sticky top-0 z-20 -mx-3 sm:mx-0 mb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-y border-border/60">
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2 no-scrollbar">
              {ROUNDS.map((r) => {
                const { picked, total } = roundProgress(r.ids);
                const done = picked === total;
                const active = activeRound === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => setActiveRound(r.key)}
                    className={[
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider whitespace-nowrap border transition",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_-8px_var(--primary)]"
                        : "bg-card/60 text-muted-foreground border-border hover:text-foreground",
                    ].join(" ")}
                  >
                    <span>{r.short}</span>
                    <span
                      className={[
                        "text-[10px] rounded-full px-1.5 py-0.5",
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : done
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {done ? <Check className="h-2.5 w-2.5 inline" /> : `${picked}/${total}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {ROUNDS.map((r) => {
            if (r.key !== activeRound) return null;
            const { picked, total } = roundProgress(r.ids);
            return (
              <section key={r.key} className="space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">{r.label}</h2>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-primary/70 font-semibold">
                      {picked} of {total} picked
                    </p>
                  </div>
                  {r.key === "F" && <Trophy className="h-6 w-6 text-primary" />}
                </div>

                {r.key === "F" ? (
                  <div className="space-y-4">
                    {finalMatch && (
                      <MatchCard match={finalMatch} locked={locked} onPick={(team) => pick(FINAL_ID, team)} />
                    )}
                    <div className="flex justify-center pt-2">
                      <Trophy className="h-10 w-10 text-primary drop-shadow-[0_0_12px_var(--primary)]" />
                    </div>
                    {ChampionCard}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {r.ids.map((id) => {
                      const m = matchById[id];
                      if (!m) return null;
                      return <MatchCard key={id} match={m} locked={locked} onPick={(team) => pick(id, team)} />;
                    })}
                  </div>
                )}

                {/* Round nav */}
                <div className="flex justify-between gap-2 pt-3">
                  {(() => {
                    const idx = ROUNDS.findIndex((x) => x.key === r.key);
                    const prev = ROUNDS[idx - 1];
                    const next = ROUNDS[idx + 1];
                    return (
                      <>
                        <button
                          disabled={!prev}
                          onClick={() => prev && setActiveRound(prev.key)}
                          className="flex-1 px-3 py-2.5 rounded-md border border-border bg-card/60 text-xs font-semibold disabled:opacity-30"
                        >
                          ← {prev?.short ?? ""}
                        </button>
                        <button
                          disabled={!next}
                          onClick={() => next && setActiveRound(next.key)}
                          className="flex-1 px-3 py-2.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-30"
                        >
                          {next?.short ?? ""} →
                        </button>
                      </>
                    );
                  })()}
                </div>
              </section>
            );
          })}
        </div>

        {/* DESKTOP — mirrored bracket */}
        <div className="hidden lg:block overflow-x-auto">
          <div className="flex items-stretch gap-3 min-w-[1400px] pb-4">
            <div className="flex gap-3 flex-1">
              {renderColumn(r32L, "Round of 32", "left")}
              {renderColumn(r16L, "Round of 16", "left")}
              {renderColumn(qfL, "Quarter-finals", "left")}
              {renderColumn(sfL, "Semi-final", "left")}
            </div>

            <div className="flex flex-col items-center justify-center gap-4 min-w-[240px] px-2">
              <h3 className="text-[10px] uppercase tracking-[0.3em] text-primary/80 font-semibold">Final</h3>
              {finalMatch && (
                <div className="w-full">
                  <MatchCard match={finalMatch} locked={locked} onPick={(team) => pick(FINAL_ID, team)} />
                </div>
              )}
              <Trophy className="h-12 w-12 text-primary drop-shadow-[0_0_16px_var(--primary)]" />
              {ChampionCard}
            </div>

            <div className="flex gap-3 flex-1 flex-row-reverse">
              {renderColumn(r32R, "Round of 32", "right")}
              {renderColumn(r16R, "Round of 16", "right")}
              {renderColumn(qfR, "Quarter-finals", "right")}
              {renderColumn(sfR, "Semi-final", "right")}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MatchCard({ match, onPick, locked }: { match: BracketMatch; onPick: (team: string) => void; locked?: boolean }) {
  const row = (team: string | null, label: string) => {
    const disabled = !team || !!locked;
    const selected = team && match.winner === team;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => team && onPick(team)}
        className={[
          "w-full text-left px-3 py-2.5 text-xs sm:text-sm rounded-md transition border uppercase tracking-wide font-semibold flex items-center justify-between gap-2",
          selected
            ? "bg-primary text-primary-foreground border-primary shadow-[inset_0_0_0_1px_var(--primary)]"
            : "bg-card/80 hover:bg-accent border-border text-foreground/90",
          disabled && !selected ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        <span className="truncate">{team ?? <span className="italic text-muted-foreground normal-case font-normal">{label}</span>}</span>
        {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
      </button>
    );
  };
  return (
    <div className="rounded-lg border border-border/70 bg-card/40 p-1.5 flex flex-col gap-1.5">
      {row(match.team1, match.label1)}
      {row(match.team2, match.label2)}
    </div>
  );
}

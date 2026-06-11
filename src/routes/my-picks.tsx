import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GROUPS, GROUP_LETTERS, R32_IDS, R16_IDS, QF_IDS, SF_IDS, FINAL_ID } from "@/lib/wc/groupsData";
import { buildFullBracket, type BracketMatch } from "@/lib/wc/bracketResolver";
import { getUserPrediction, getActualResults } from "@/lib/wc/predictions.functions";
import { getUserBetPointsTotal } from "@/lib/wc/bets.functions";
import { getUser } from "@/lib/wc/session";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { Trophy, Check } from "lucide-react";
import { getFlag } from "@/lib/wc/flags";

export const Route = createFileRoute("/my-picks")({
  head: () => ({ meta: [{ title: "My Picks — WC 2026" }] }),
  component: MyPicksPage,
});

const ROUNDS = [
  { key: "R32" as const, label: "Round of 32", short: "R32", ids: R32_IDS },
  { key: "R16" as const, label: "Round of 16", short: "R16", ids: R16_IDS },
  { key: "QF" as const, label: "Quarter-finals", short: "QF", ids: QF_IDS },
  { key: "SF" as const, label: "Semi-finals", short: "SF", ids: SF_IDS },
  { key: "F" as const, label: "Final", short: "Final", ids: [FINAL_ID] },
];

// ── Accuracy circle ────────────────────────────────────────────────────────
function AccuracyCircle({ pct, label, color = "var(--primary)", pending = false }: { pct: number; label: string; color?: string; pending?: boolean }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ filter: pending ? "none" : `drop-shadow(0 0 8px ${color}55)` }}>
        <svg width="88" height="88" viewBox="0 0 88 88">
          {/* Track */}
          <circle cx="44" cy="44" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
          {/* Progress */}
          <circle
            cx="44" cy="44" r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
            style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" }}
          />
          {/* Percentage */}
          <text x="44" y="47" textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor" letterSpacing="-0.5">
            {Math.round(pct)}%
          </text>
        </svg>
      </div>
      <span className="text-[11px] uppercase tracking-[0.15em] font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

function calcAccuracy(
  userG: Record<string, string[]>,
  userK: Record<string, string>,
  actualG: Record<string, string[]>,
  actualK: Record<string, string>,
) {
  // Group accuracy: correct positions / total resolved positions
  let gCorrect = 0, gTotal = 0;
  for (const g of GROUP_LETTERS) {
    const u = userG[g], a = actualG[g];
    if (!u || !a) continue;
    // Only count if group is fully resolved (all 4 teams placed)
    if (a.length < 4) continue;
    for (let i = 0; i < 4; i++) { gTotal++; if (u[i] === a[i]) gCorrect++; }
  }

  // Bracket accuracy: correct picks / resolved matches
  const ALL_IDS = [...R32_IDS, ...R16_IDS, ...QF_IDS, ...SF_IDS, FINAL_ID];
  let kCorrect = 0, kTotal = 0;
  for (const id of ALL_IDS) {
    if (actualK[id]) { kTotal++; if (userK[id] === actualK[id]) kCorrect++; }
  }

  return {
    groupPct: gTotal > 0 ? (gCorrect / gTotal) * 100 : 0,
    bracketPct: kTotal > 0 ? (kCorrect / kTotal) * 100 : 0,
    hasGroupData: gTotal > 0,
    hasBracketData: kTotal > 0,
  };
}

function MyPicksPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<number | null>(null);
  const fetchPrediction = useServerFn(getUserPrediction);
  const fetchActual = useServerFn(getActualResults);
  const fetchBetPts = useServerFn(getUserBetPointsTotal);
  const [activeRound, setActiveRound] = useState<(typeof ROUNDS)[number]["key"]>("R32");

  useEffect(() => {
    const u = getUser();
    if (!u) { navigate({ to: "/" }); return; }
    setUserId(u.userId);
  }, [navigate]);

  // Poll every 3 minutes so accuracy, points and bracket update live as games finish
  const POLL_MS = 3 * 60 * 1000;

  const { data, isLoading } = useQuery({
    queryKey: ["my-picks", userId],
    queryFn: () => fetchPrediction({ data: { userId: userId! } }),
    enabled: !!userId,
    refetchInterval: POLL_MS,
  });

  const { data: actual } = useQuery({
    queryKey: ["actual-results"],
    queryFn: () => fetchActual(),
    refetchInterval: POLL_MS,
  });

  const { data: betPts = 0 } = useQuery({
    queryKey: ["my-bet-pts", userId],
    queryFn: () => fetchBetPts({ data: { userId: userId! } }),
    enabled: !!userId,
    refetchInterval: POLL_MS,
  });

  // Only show points once the tournament has started (getActualResults returns null before then).
  // Guards against stale test data in the DB showing non-zero points pre-tournament.
  const tournamentStarted = !!actual;
  const totalPoints = tournamentStarted ? (data?.points ?? 0) + betPts : 0;

  const rankings = data?.groupRankings as Record<string, string[]> | undefined;
  const picks = (data?.knockoutPicks as Record<string, string>) ?? {};

  // Extract thirds selection encoded at submit time (stored under __thirds__ key)
  const savedThirds = useMemo<string[] | undefined>(() => {
    try {
      const raw = picks["__thirds__"];
      if (!raw) return undefined;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length === 8 ? arr : undefined;
    } catch { return undefined; }
  }, [picks]);

  const bracket = useMemo<BracketMatch[]>(() => {
    if (!rankings) return [];
    return buildFullBracket(rankings, picks, savedThirds);
  }, [rankings, picks, savedThirds]);

  const matchById = useMemo(() => {
    const m: Record<string, BracketMatch> = {};
    for (const b of bracket) m[b.id] = b;
    return m;
  }, [bracket]);

  const accuracy = useMemo(() => {
    if (!data) return null;
    const calc = actual
      ? calcAccuracy(
          data.groupRankings as Record<string, string[]>,
          data.knockoutPicks as Record<string, string>,
          actual.groupRankings as Record<string, string[]>,
          actual.knockoutResults as Record<string, string>,
        )
      : { groupPct: 0, bracketPct: 0, hasGroupData: false, hasBracketData: false };

    return {
      groupPct: calc.hasGroupData ? calc.groupPct : 100,
      bracketPct: calc.hasBracketData ? calc.bracketPct : 100,
      hasGroupData: calc.hasGroupData,
      hasBracketData: calc.hasBracketData,
    };
  }, [data, actual]);

  if (!userId || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">You haven't submitted your predictions yet.</p>
          <Link to="/predict/group" className="mt-4 inline-block text-primary hover:underline">Make your picks →</Link>
        </main>
      </div>
    );
  }

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
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <h3 className={["text-[9px] uppercase tracking-[0.2em] text-primary/70 font-semibold mb-1 truncate", align === "right" ? "text-right" : "text-left"].join(" ")}>
        {title}
      </h3>
      <div className="flex flex-col justify-around flex-1 gap-2">
        {ids.map((id) => {
          const m = matchById[id];
          if (!m) return null;
          return <MatchCard key={id} match={m} compact />;
        })}
      </div>
    </div>
  );

  const ChampionCard = (
    <div className={["w-full rounded-lg border-2 px-3 py-4 text-center transition", champion ? "border-primary bg-gradient-to-b from-primary/15 to-primary/5 shadow-[0_0_30px_-10px_var(--primary)]" : "border-dashed border-border/60 bg-card/40"].join(" ")}>
      <div className="text-[9px] uppercase tracking-[0.25em] text-primary/80 font-semibold mb-2">Champion</div>
      <div className={["text-sm font-extrabold uppercase tracking-wider", champion ? "text-primary" : "text-muted-foreground italic"].join(" ")}>
        {champion ?? "TBD"}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="w-full px-1 sm:px-2 py-5 sm:py-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto px-2 mb-5">
          <h1 className="text-3xl font-bold tracking-tight uppercase mb-1">My Picks</h1>
          <p className="text-muted-foreground text-sm">
            <span className="text-primary font-semibold">{totalPoints} pts</span>
            {tournamentStarted && betPts > 0 && (
              <span className="text-muted-foreground"> ({data.points} bracket + <span className="text-yellow-400">{betPts} bets</span>)</span>
            )}
            <span className="text-muted-foreground"> · locked predictions</span>
          </p>
        </div>

        {/* Accuracy circles */}
        {accuracy && (
          <div className="max-w-3xl mx-auto px-2 mb-6">
            <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-card/60 p-6 flex flex-col items-center gap-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Prediction Accuracy</p>
              <div className="flex items-center justify-center gap-16">
                <AccuracyCircle
                  pct={accuracy.groupPct}
                  label="Groups"
                  color={accuracy.hasGroupData ? "var(--primary)" : "var(--muted-foreground)"}
                  pending={!accuracy.hasGroupData}
                />
                <div className="w-px h-16 bg-border" />
                <AccuracyCircle
                  pct={accuracy.bracketPct}
                  label="Bracket"
                  color={accuracy.hasBracketData ? "#3b82f6" : "var(--muted-foreground)"}
                  pending={!accuracy.hasBracketData}
                />
              </div>
              {(!accuracy.hasGroupData || !accuracy.hasBracketData) && (
                <p className="text-[11px] text-muted-foreground/70 italic">
                  {!accuracy.hasGroupData
                    ? "Accuracy updates as matches are played"
                    : "Bracket accuracy updates once knockout matches begin"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Group stage */}
        <section className="max-w-6xl mx-auto px-2 mb-8">
          <h2 className="text-xl font-bold mb-4">Group Stage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GROUP_LETTERS.map((g) => {
              const ranked = rankings?.[g] ?? [];
              return (
                <div key={g} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
                    <h3 className="text-xs font-bold tracking-widest text-muted-foreground">GROUP {g}</h3>
                    <span className="text-[10px] font-bold tracking-wider text-primary">
                      {ranked.length === 4 ? "DONE" : `${ranked.length}/4`}
                    </span>
                  </div>
                  <ul className="p-2 space-y-1.5">
                    {ranked.map((team, idx) => (
                      <li key={team}>
                        <div className={["w-full flex items-center gap-3 px-3 py-2 rounded text-sm border", idx < 3 ? "bg-secondary/70 border-primary/40 text-foreground font-medium" : "bg-secondary/40 border-border text-muted-foreground"].join(" ")}>
                          <span className={["inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0", idx === 0 ? "bg-primary text-primary-foreground" : idx === 1 || idx === 2 ? "bg-secondary text-foreground border border-border" : "bg-muted text-muted-foreground"].join(" ")}>
                            {idx + 1}
                          </span>
                          {(() => { const f = getFlag(team); return f ? <span className={`fi fi-${f} shrink-0`} /> : null; })()}
                          <span className="flex-1 text-left uppercase tracking-wide text-[13px]">{team}</span>
                        </div>
                      </li>
                    ))}
                    {GROUPS[g].filter((t) => !ranked.includes(t)).map((team) => (
                      <li key={team}>
                        <div className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm border border-transparent text-foreground/50">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs border border-border text-muted-foreground shrink-0" />
                          {(() => { const f = getFlag(team); return f ? <span className={`fi fi-${f} shrink-0 opacity-40`} /> : null; })()}
                          <span className="flex-1 text-left uppercase tracking-wide text-[13px]">{team}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Knockout bracket */}
        <section className="max-w-6xl mx-auto px-2">
          <h2 className="text-xl font-bold mb-4">Knockout Bracket</h2>

          {/* MOBILE */}
          <div className="lg:hidden">
            <div className="sticky top-0 z-20 -mx-1 sm:mx-0 mb-4 bg-background/95 backdrop-blur border-y border-border/60">
              <div className="flex gap-1.5 overflow-x-auto px-3 py-2 no-scrollbar">
                {ROUNDS.map((r) => {
                  const { picked, total } = roundProgress(r.ids);
                  const done = picked === total;
                  const active = activeRound === r.key;
                  return (
                    <button key={r.key} onClick={() => setActiveRound(r.key)} className={["flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider whitespace-nowrap border transition", active ? "bg-primary text-primary-foreground border-primary" : "bg-card/60 text-muted-foreground border-border hover:text-foreground"].join(" ")}>
                      <span>{r.short}</span>
                      <span className={["text-[10px] rounded-full px-1.5 py-0.5", active ? "bg-primary-foreground/20 text-primary-foreground" : done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"].join(" ")}>
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
                      <h3 className="text-lg font-bold tracking-tight">{r.label}</h3>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-primary/70 font-semibold">{picked} of {total} picked</p>
                    </div>
                    {r.key === "F" && <Trophy className="h-6 w-6 text-primary" />}
                  </div>
                  {r.key === "F" ? (
                    <div className="space-y-4 max-w-sm mx-auto">
                      {finalMatch && <MatchCard match={finalMatch} />}
                      <div className="flex justify-center pt-2"><Trophy className="h-10 w-10 text-primary drop-shadow-[0_0_12px_var(--primary)]" /></div>
                      {ChampionCard}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {r.ids.map((id) => { const m = matchById[id]; if (!m) return null; return <MatchCard key={id} match={m} />; })}
                    </div>
                  )}
                  <div className="flex justify-between gap-2 pt-3">
                    {(() => {
                      const idx = ROUNDS.findIndex((x) => x.key === r.key);
                      const prev = ROUNDS[idx - 1]; const next = ROUNDS[idx + 1];
                      return (<>
                        <button disabled={!prev} onClick={() => prev && setActiveRound(prev.key)} className="flex-1 px-3 py-2.5 rounded-md border border-border bg-card/60 text-xs font-semibold disabled:opacity-30">← {prev?.short ?? ""}</button>
                        <button disabled={!next} onClick={() => next && setActiveRound(next.key)} className="flex-1 px-3 py-2.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-30">{next?.short ?? ""} →</button>
                      </>);
                    })()}
                  </div>
                </section>
              );
            })}
          </div>

          {/* DESKTOP */}
          <div className="hidden lg:flex items-stretch gap-1.5 w-full">
            <div className="flex gap-1.5 flex-1 min-w-0">
              {renderColumn(r32L, "Round of 32", "left")}
              {renderColumn(r16L, "Round of 16", "left")}
              {renderColumn(qfL, "Quarter-finals", "left")}
              {renderColumn(sfL, "Semi-final", "left")}
            </div>
            <div className="flex flex-col items-center justify-center gap-3 w-[160px] shrink-0 px-1">
              <h3 className="text-[9px] uppercase tracking-[0.25em] text-primary/80 font-semibold">Final</h3>
              {finalMatch && <div className="w-full"><MatchCard match={finalMatch} compact /></div>}
              <Trophy className="h-8 w-8 text-primary drop-shadow-[0_0_12px_var(--primary)]" />
              {ChampionCard}
            </div>
            <div className="flex gap-1.5 flex-1 min-w-0 flex-row-reverse">
              {renderColumn(r32R, "Round of 32", "right")}
              {renderColumn(r16R, "Round of 16", "right")}
              {renderColumn(qfR, "Quarter-finals", "right")}
              {renderColumn(sfR, "Semi-final", "right")}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MatchCard({ match, compact = false }: { match: BracketMatch; compact?: boolean }) {
  const row = (team: string | null, label: string) => {
    const selected = team && match.winner === team;
    const flag = team ? getFlag(team) : null;
    return (
      <div className={["w-full text-left rounded border uppercase tracking-wide font-semibold flex items-center gap-1.5", compact ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-xs sm:text-sm", selected ? "bg-primary text-primary-foreground border-primary" : "bg-card/80 border-border text-foreground/90 opacity-60"].join(" ")}>
        {flag && <span className={`fi fi-${flag} shrink-0`} />}
        <span className="truncate flex-1">{team ?? <span className="italic text-muted-foreground normal-case font-normal">{label}</span>}</span>
        {selected && <Check className={compact ? "h-2.5 w-2.5 shrink-0" : "h-3.5 w-3.5 shrink-0"} />}
      </div>
    );
  };
  return (
    <div className={["rounded border border-border/70 bg-card/40 flex flex-col", compact ? "p-1 gap-1" : "p-1.5 gap-1.5"].join(" ")}>
      {row(match.team1, match.label1)}
      {row(match.team2, match.label2)}
    </div>
  );
}

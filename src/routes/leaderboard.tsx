import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getLeaderboard, getCommunityStats } from "@/lib/wc/predictions.functions";
import { getAllBetsForGrid } from "@/lib/wc/bets.functions";
import { getSchedule } from "@/lib/wc/schedule.functions";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { GROUP_LETTERS } from "@/lib/wc/groupsData";
import { getFlag } from "@/lib/wc/flags";
import { Trophy, Users, BarChart2 } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Ranking — World Cup 2026 Predictions" },
      { name: "description", content: "See who is leading the World Cup 2026 bracket prediction contest." },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const fetchLb = useServerFn(getLeaderboard);
  const fetchCommunity = useServerFn(getCommunityStats);
  const POLL_MS = 3 * 60 * 1000;
  const { data, isLoading } = useQuery({ queryKey: ["leaderboard"], queryFn: () => fetchLb(), refetchInterval: POLL_MS });
  const { data: community } = useQuery({ queryKey: ["community-stats"], queryFn: () => fetchCommunity(), refetchInterval: POLL_MS });
  const childMatches = useChildMatches();

  if (childMatches.length > 0) return <Outlet />;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="h-7 w-7 text-primary" /> Ranking</h1>
        <p className="text-muted-foreground mt-1">
          Groups: 3/2/1 pts · Bracket: 1pt/match · Perfect: +50 · Champion: +5 · Score bets: exact +3, winner +1
        </p>

        <div className="mt-6 flex flex-col lg:flex-row gap-6 items-start">
          {/* Ranking table */}
          <div className="w-full lg:w-[380px] shrink-0">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading…</div>
              ) : !data || data.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">No predictions yet. Be the first!</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left px-4 py-2 w-12">#</th>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-right px-4 py-2 w-28">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={`${row.userId}-${i}`} className="border-t border-border hover:bg-accent/40 transition-colors">
                        <td className="px-4 py-2 font-mono text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-2 font-medium">
                          <Link
                            to="/leaderboard/$userId"
                            params={{ userId: String(row.userId) }}
                            className="hover:text-primary hover:underline"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="font-bold text-primary">{row.points}</span>
                          {(row as any).betPoints > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              {(row as any).predictionPoints} + <span className="text-yellow-400">{(row as any).betPoints} bets</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground text-center">Click a name to see their predictions</p>
          </div>

          {/* Community Picks */}
          {community && (community.champions.length > 0 || Object.keys(community.groupWinners).length > 0) && (
            <section className="flex-1 min-w-0">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" /> Community Picks
              </h2>

              {community.champions.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-4 mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">🏆 Most picked champion</p>
                  <div className="flex flex-col gap-2">
                    {community.champions.map((c, i) => {
                      const f = getFlag(c.team);
                      const pct = Math.round((c.votes / c.total) * 100);
                      return (
                        <div key={c.team} className="flex items-center gap-3">
                          <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}</span>
                          {f && <span className={`fi fi-${f} shrink-0`} />}
                          <span className="font-semibold text-sm flex-1 uppercase tracking-wide">{c.team}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-16 text-right">{c.votes}/{c.total} players</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {Object.keys(community.groupWinners).length > 0 && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Most picked group winner</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {GROUP_LETTERS.map((g) => {
                      const w = community.groupWinners[g];
                      if (!w) return null;
                      const f = getFlag(w.team);
                      const pct = Math.round((w.votes / w.total) * 100);
                      return (
                        <div key={g} className="flex items-center gap-2 py-1 border-b border-border/30">
                          <span className="text-[10px] font-bold text-muted-foreground w-8 shrink-0">GRP {g}</span>
                          {f && <span className={`fi fi-${f} shrink-0 text-sm`} />}
                          <span className="text-xs font-semibold truncate flex-1">{w.team}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Bet Results Grid */}
        <BetResultsGrid />
      </main>
    </div>
  );
}

function BetResultsGrid() {
  const fetchGrid = useServerFn(getAllBetsForGrid);
  const fetchSchedule = useServerFn(getSchedule);

  const { data: gridData } = useQuery({
    queryKey: ["bets-grid"],
    queryFn: () => fetchGrid(),
    refetchInterval: 60_000,
  });

  const { data: allMatches = [] } = useQuery({
    queryKey: ["schedule"],
    queryFn: () => fetchSchedule(),
    refetchInterval: 60_000,
  });

  const finishedMatches = useMemo(
    () =>
      allMatches
        .filter((m) => m.status === "FINISHED")
        .sort((a, b) => a.utcDate.localeCompare(b.utcDate)),
    [allMatches],
  );

  const { users = [], bets = [] } = gridData ?? {};

  const isLoading = !gridData || finishedMatches.length === 0;

  if (isLoading) {
    return (
      <section className="mt-10">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <BarChart2 className="h-5 w-5 text-primary" /> Score Predictions Grid
        </h2>
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
          {!gridData ? "Loading grid…" : "No finished matches yet."}
        </div>
      </section>
    );
  }

  // userId → matchId → bet
  const betMap = new Map<number, Map<number, typeof bets[0]>>();
  for (const bet of bets) {
    if (!betMap.has(bet.userId)) betMap.set(bet.userId, new Map());
    betMap.get(bet.userId)!.set(bet.matchId, bet);
  }

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
        <BarChart2 className="h-5 w-5 text-primary" /> Score Predictions Grid
      </h2>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-secondary/50">
                <th className="sticky left-0 bg-secondary/80 backdrop-blur z-10 px-3 py-2 text-left font-semibold min-w-[130px] border-r border-border/60">
                  Player
                </th>
                {finishedMatches.map((m) => {
                  const hf = getFlag(m.homeTeam);
                  const af = getFlag(m.awayTeam);
                  return (
                    <th
                      key={m.id}
                      className="px-1 py-2 text-center min-w-[48px] border-r border-border/30"
                      title={`${m.homeTeam} vs ${m.awayTeam}`}
                    >
                      <div className="flex flex-col items-center gap-px">
                        {hf ? <span className={`fi fi-${hf} text-sm`} /> : <span className="text-[9px]">{m.homeTeam.slice(0,3)}</span>}
                        <span className="text-[7px] text-muted-foreground leading-none">vs</span>
                        {af ? <span className={`fi fi-${af} text-sm`} /> : <span className="text-[9px]">{m.awayTeam.slice(0,3)}</span>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId} className="border-t border-border/30 hover:bg-accent/20 transition-colors">
                  <td className="sticky left-0 bg-card z-10 px-3 py-1.5 font-medium border-r border-border/60 max-w-[130px] truncate">
                    {user.name}
                  </td>
                  {finishedMatches.map((m) => {
                    const bet = betMap.get(user.userId)?.get(m.id);
                    if (!bet) {
                      return (
                        <td key={m.id} className="px-1 py-1.5 text-center border-r border-border/20">
                          <span className="text-[10px] text-muted-foreground/30 font-medium">N/A</span>
                        </td>
                      );
                    }
                    const cellCls = bet.resolved
                      ? bet.points === 3
                        ? "bg-green-500/20 text-green-400"
                        : bet.points === 1
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/10 text-muted-foreground"
                      : "text-foreground/50"; // finished but not yet resolved by edge fn
                    return (
                      <td
                        key={m.id}
                        className={`px-1 py-1.5 text-center border-r border-border/20 ${cellCls}`}
                      >
                        <span className="font-bold tabular-nums text-[11px]">
                          {bet.homeScore}–{bet.awayScore}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground text-center">
        <span className="text-green-400 font-bold">■</span> Exact (+3) &nbsp;
        <span className="text-yellow-400 font-bold">■</span> Correct outcome (+1) &nbsp;
        <span className="text-muted-foreground font-bold">■</span> Wrong (+0) &nbsp;
        <span className="text-muted-foreground/40">N/A</span> = no bet placed
      </p>
    </section>
  );
}

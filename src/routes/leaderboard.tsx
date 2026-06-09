import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard, getCommunityStats } from "@/lib/wc/predictions.functions";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { GROUP_LETTERS } from "@/lib/wc/groupsData";
import { getFlag } from "@/lib/wc/flags";
import { Trophy, Users } from "lucide-react";

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
  const { data, isLoading } = useQuery({ queryKey: ["leaderboard"], queryFn: () => fetchLb() });
  const { data: community } = useQuery({ queryKey: ["community-stats"], queryFn: () => fetchCommunity() });
  const childMatches = useChildMatches();

  if (childMatches.length > 0) return <Outlet />;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="h-7 w-7 text-primary" /> Ranking</h1>
        <p className="text-muted-foreground mt-1">
          Groups: 3/2/1 pts per correct position · Bracket: 1 pt/match · Perfect bracket: +50 · Champion: +5 · Max 158 pts
        </p>

        <div className="mt-6 rounded-lg border border-border bg-card overflow-hidden">
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
                  <th className="text-right px-4 py-2 w-24">Points</th>
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
                    <td className="px-4 py-2 text-right font-bold text-primary">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground text-center">Click a name to see their predictions</p>

        {/* Community Picks */}
        {community && (community.champions.length > 0 || Object.keys(community.groupWinners).length > 0) && (
          <section className="mt-10">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" /> Community Picks
            </h2>

            {/* Champion podium */}
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

            {/* Group winners grid */}
            {Object.keys(community.groupWinners).length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Most picked group winner</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
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
      </main>
    </div>
  );
}

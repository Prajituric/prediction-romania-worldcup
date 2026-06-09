import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/wc/predictions.functions";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { Trophy } from "lucide-react";

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
  const { data, isLoading } = useQuery({ queryKey: ["leaderboard"], queryFn: () => fetchLb() });

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
      </main>
    </div>
  );
}

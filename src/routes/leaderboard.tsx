import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/wc/predictions.functions";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — World Cup 2026 Predictions" },
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
        <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="h-7 w-7 text-primary" /> Leaderboard</h1>
        <p className="text-muted-foreground mt-1">1 point per correct knockout match (R32 → Final).</p>

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
                  <tr key={`${row.name}-${i}`} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-medium">{row.name}</td>
                    <td className="px-4 py-2 text-right font-bold text-primary">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

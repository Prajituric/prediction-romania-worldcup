import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { GROUPS, GROUP_LETTERS, R32_IDS, R16_IDS, QF_IDS, SF_IDS, FINAL_ID } from "@/lib/wc/groupsData";
import { buildFullBracket, type BracketMatch } from "@/lib/wc/bracketResolver";
import { getUserPrediction } from "@/lib/wc/predictions.functions";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { Trophy, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/leaderboard/$userId")({
  head: () => ({
    meta: [{ title: "View Predictions — World Cup 2026" }],
  }),
  component: ViewUserPredictions,
});

function ViewUserPredictions() {
  const { userId } = Route.useParams();
  const fetchPrediction = useServerFn(getUserPrediction);

  const { data, isLoading } = useQuery({
    queryKey: ["user-prediction", userId],
    queryFn: () => fetchPrediction({ data: { userId: Number(userId) } }),
  });

  const rankings = data?.groupRankings as Record<string, string[]> | undefined;
  const picks = (data?.knockoutPicks as Record<string, string>) ?? {};

  const bracket = useMemo<BracketMatch[]>(() => {
    if (!rankings) return [];
    return buildFullBracket(rankings, picks);
  }, [rankings, picks]);

  const matchById = useMemo(() => {
    const m: Record<string, BracketMatch> = {};
    for (const b of bracket) m[b.id] = b;
    return m;
  }, [bracket]);

  const half = (arr: string[]) => {
    const h = arr.length / 2;
    return [arr.slice(0, h), arr.slice(h)] as const;
  };
  const [r32L, r32R] = half(R32_IDS);
  const [r16L, r16R] = half(R16_IDS);
  const [qfL, qfR] = half(QF_IDS);
  const [sfL, sfR] = [[SF_IDS[0]], [SF_IDS[1]]];

  const renderColumn = (ids: string[], title: string, align: "left" | "right") => (
    <div className="flex flex-col gap-2 min-w-[170px] flex-1">
      <h3 className={["text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold", align === "right" ? "text-right" : "text-left"].join(" ")}>
        {title}
      </h3>
      <div className="flex flex-col justify-around flex-1 gap-3">
        {ids.map((id) => {
          const m = matchById[id];
          if (!m) return null;
          return <MatchCard key={id} match={m} />;
        })}
      </div>
    </div>
  );

  if (isLoading) {
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
          <p className="text-muted-foreground">No predictions found for this user.</p>
          <Link to="/leaderboard" className="mt-4 inline-block text-primary hover:underline">← Back to Ranking</Link>
        </main>
      </div>
    );
  }

  const champion = matchById[FINAL_ID]?.winner ?? null;
  const finalMatch = matchById[FINAL_ID];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[1600px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/leaderboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Ranking
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">Predictions · {data.points} pts</span>
        </div>

        <div className="mb-4 p-3 rounded-md border border-primary/40 bg-primary/5 text-sm text-center">
          👁 View only — these are someone else's predictions
        </div>

        {/* Group stage */}
        <section className="mb-10">
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
                        <div className={[
                          "w-full flex items-center gap-3 px-3 py-2 rounded text-sm border",
                          idx < 3
                            ? "bg-secondary/70 border-primary/40 text-foreground font-medium"
                            : "bg-secondary/40 border-border text-muted-foreground",
                        ].join(" ")}>
                          <span className={[
                            "inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0",
                            idx === 0
                              ? "bg-primary text-primary-foreground"
                              : idx === 1 || idx === 2
                              ? "bg-secondary text-foreground border border-border"
                              : "bg-muted text-muted-foreground",
                          ].join(" ")}>
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-left uppercase tracking-wide text-[13px]">{team}</span>
                        </div>
                      </li>
                    ))}
                    {GROUPS[g].filter((t) => !ranked.includes(t)).map((team) => (
                      <li key={team}>
                        <div className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm border border-transparent text-foreground/50">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs border border-border text-muted-foreground shrink-0" />
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
        <section>
          <h2 className="text-xl font-bold mb-4">Knockout Bracket</h2>
          <div className="overflow-x-auto">
            <div className="flex items-stretch gap-3 min-w-[1400px] pb-4">
              {/* Left half */}
              <div className="flex gap-3 flex-1">
                {renderColumn(r32L, "Round of 32", "left")}
                {renderColumn(r16L, "Round of 16", "left")}
                {renderColumn(qfL, "Quarter-finals", "left")}
                {renderColumn(sfL, "Semi-final", "left")}
              </div>

              {/* Center: Final + Champion */}
              <div className="flex flex-col items-center justify-center gap-4 min-w-[220px] px-2">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Final</h3>
                {finalMatch && <div className="w-full"><MatchCard match={finalMatch} /></div>}
                <Trophy className="h-10 w-10 text-primary" />
                <div className={["w-full rounded-lg border-2 px-4 py-5 text-center", champion ? "border-primary bg-primary/10" : "border-dashed border-border bg-card/50"].join(" ")}>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2">Champion</div>
                  <div className={["text-lg font-bold uppercase tracking-wide", champion ? "text-primary" : "text-muted-foreground italic"].join(" ")}>
                    {champion ?? "TBD"}
                  </div>
                </div>
              </div>

              {/* Right half — mirrored */}
              <div className="flex gap-3 flex-1 flex-row-reverse">
                {renderColumn(r32R, "Round of 32", "right")}
                {renderColumn(r16R, "Round of 16", "right")}
                {renderColumn(qfR, "Quarter-finals", "right")}
                {renderColumn(sfR, "Semi-final", "right")}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MatchCard({ match }: { match: BracketMatch }) {
  const row = (team: string | null, label: string) => (
    <div className={[
      "w-full text-left px-3 py-2 text-sm rounded border",
      team && match.winner === team
        ? "bg-primary text-primary-foreground border-primary font-semibold"
        : "bg-card border-border opacity-60",
    ].join(" ")}>
      {team ?? <span className="italic text-muted-foreground">{label}</span>}
    </div>
  );
  return (
    <div className="rounded-lg border border-border bg-card/50 p-2 flex flex-col gap-1.5">
      <div className="text-[10px] text-muted-foreground font-mono px-1">{match.id}</div>
      {row(match.team1, match.label1)}
      {row(match.team2, match.label2)}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { format, parseISO, isToday, isTomorrow, differenceInMinutes, differenceInHours } from "date-fns";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { getSchedule, type WCMatch } from "@/lib/wc/schedule.functions";
import { getFlag } from "@/lib/wc/flags";
import { getCaptain } from "@/lib/wc/captains";
import { saveBet, getBet, type Bet } from "@/lib/wc/bets";
import { Calendar, MapPin, Clock, Flame, Lock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/schedule")({
  head: () => ({ meta: [{ title: "Schedule — WC 2026" }] }),
  component: SchedulePage,
});

const STAGE_LABEL: Record<string, string> = {
  GROUP_STAGE: "Group Stage",
  LAST_32: "Round of 32",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "3rd Place",
  FINAL: "Final",
};

function stageLabel(s: string) {
  return STAGE_LABEL[s] ?? s.replace(/_/g, " ");
}

function dateLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, d MMMM");
}

function countdown(dateStr: string) {
  const now = new Date();
  const d = parseISO(dateStr);
  const mins = differenceInMinutes(d, now);
  if (mins < 0) return null;
  if (mins < 60) return `in ${mins}m`;
  const hrs = differenceInHours(d, now);
  if (hrs < 24) return `in ${hrs}h`;
  return null;
}

function groupByDate(matches: WCMatch[]) {
  const map = new Map<string, WCMatch[]>();
  for (const m of matches) {
    const key = m.utcDate.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

type Filter = "all" | "live" | "upcoming" | "finished";

function SchedulePage() {
  const fetch = useServerFn(getSchedule);
  const [filter, setFilter] = useState<Filter>("all");

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["schedule"],
    queryFn: () => fetch(),
    refetchInterval: 60_000, // refresh every minute
  });

  const filtered = useMemo(() => {
    if (filter === "live") return matches.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
    if (filter === "upcoming") return matches.filter((m) => m.status === "SCHEDULED" || m.status === "TIMED");
    if (filter === "finished") return matches.filter((m) => m.status === "FINISHED");
    return matches;
  }, [matches, filter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const liveCount = useMemo(() => matches.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED").length, [matches]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight uppercase mb-1">Schedule</h1>
          <p className="text-muted-foreground text-sm">All World Cup 2026 matches</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto no-scrollbar">
          {(["all", "live", "upcoming", "finished"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider whitespace-nowrap border transition shrink-0",
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/60 text-muted-foreground border-border hover:text-foreground",
              ].join(" ")}
            >
              {f === "live" && liveCount > 0 && (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              )}
              {f === "all" ? "All Matches" : f === "live" ? `Live${liveCount > 0 ? ` (${liveCount})` : ""}` : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading schedule…</div>
        )}

        {!isLoading && matches.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Schedule not available yet. Check back closer to the tournament.
          </div>
        )}

        {!isLoading && matches.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">No matches in this filter.</div>
        )}

        <div className="space-y-8">
          {grouped.map(([dateKey, dayMatches]) => (
            <section key={dateKey}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-3.5 w-3.5 text-primary/70" />
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">
                  {dateLabel(dayMatches[0].utcDate)}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(dayMatches[0].utcDate), "d MMM yyyy")}
                </span>
              </div>
              <div className="space-y-2">
                {dayMatches.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function MatchCard({ match }: { match: WCMatch }) {
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const isUpcoming = !isLive && !isFinished;
  const betLocked = !isUpcoming;
  const cd = isUpcoming ? countdown(match.utcDate) : null;

  const homeFlag = getFlag(match.homeTeam);
  const awayFlag = getFlag(match.awayTeam);
  const homeCaptain = getCaptain(match.homeTeam);
  const awayCaptain = getCaptain(match.awayTeam);

  const homeWon = match.winner === "HOME_TEAM";
  const awayWon = match.winner === "AWAY_TEAM";

  const [betOpen, setBetOpen] = useState(false);
  const [bet, setBetState] = useState<Bet | null>(null);
  const [homeInput, setHomeInput] = useState(0);
  const [awayInput, setAwayInput] = useState(0);

  useEffect(() => {
    const saved = getBet(match.id);
    if (saved) { setBetState(saved); setHomeInput(saved.homeScore); setAwayInput(saved.awayScore); }
  }, [match.id]);

  const lockBet = () => {
    const b = { homeScore: homeInput, awayScore: awayInput };
    saveBet(match.id, b);
    setBetState(b);
    setBetOpen(false);
  };

  return (
    <div className={[
      "rounded-xl border bg-card overflow-hidden transition",
      isLive ? "border-red-500/50 shadow-[0_0_20px_-8px_rgba(239,68,68,0.4)]" : "border-border/60",
    ].join(" ")}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-secondary/20">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {stageLabel(match.stage)}
          </span>
          {match.group && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[10px] text-muted-foreground">{match.group}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isLive ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-wider">
              <Flame className="h-3 w-3" />
              Live
            </span>
          ) : isFinished ? (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">FT</span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {format(parseISO(match.utcDate), "HH:mm")}
              {cd && <span className="text-primary/70 font-medium ml-1">{cd}</span>}
            </span>
          )}
        </div>
      </div>

      {/* Match body — clickable to open bet */}
      <button
        type="button"
        onClick={() => !betLocked && setBetOpen((v) => !v)}
        className={["w-full px-3 py-3 flex items-center gap-3 text-left", !betLocked ? "cursor-pointer hover:bg-secondary/10" : "cursor-default"].join(" ")}
      >
        {/* Home team */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {homeFlag && <span className={`fi fi-${homeFlag} text-lg shrink-0`} />}
            <div className="min-w-0">
              <div className={["font-bold uppercase tracking-wide text-sm truncate", isFinished && awayWon ? "text-muted-foreground" : "text-foreground", homeWon ? "text-primary" : ""].join(" ")}>
                {match.homeTeam}
              </div>
              {homeCaptain && <div className="text-[10px] text-muted-foreground truncate">{homeCaptain}</div>}
            </div>
          </div>
        </div>

        {/* Score / VS */}
        <div className="shrink-0 text-center w-16">
          {isFinished || isLive ? (
            <div className="flex items-center justify-center gap-1">
              <span className={["text-xl font-extrabold tabular-nums", homeWon ? "text-primary" : "text-foreground"].join(" ")}>{match.homeScore ?? 0}</span>
              <span className="text-muted-foreground text-sm">–</span>
              <span className={["text-xl font-extrabold tabular-nums", awayWon ? "text-primary" : "text-foreground"].join(" ")}>{match.awayScore ?? 0}</span>
            </div>
          ) : bet ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-primary/70 font-semibold">Your bet</span>
              <span className="text-sm font-extrabold tabular-nums text-primary">{bet.homeScore}–{bet.awayScore}</span>
            </div>
          ) : (
            <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">vs</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 min-w-0 flex justify-end">
          <div className="flex items-center gap-2 flex-row-reverse text-right">
            {awayFlag && <span className={`fi fi-${awayFlag} text-lg shrink-0`} />}
            <div className="min-w-0">
              <div className={["font-bold uppercase tracking-wide text-sm truncate", isFinished && homeWon ? "text-muted-foreground" : "text-foreground", awayWon ? "text-primary" : ""].join(" ")}>
                {match.awayTeam}
              </div>
              {awayCaptain && <div className="text-[10px] text-muted-foreground truncate">{awayCaptain}</div>}
            </div>
          </div>
        </div>
      </button>

      {/* Stadium */}
      {match.venue && (
        <div className="px-3 pb-2 flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <span className="text-[10px] text-muted-foreground truncate">{match.venue}</span>
        </div>
      )}

      {/* Bet panel — inline expansion */}
      {betLocked && bet && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40 bg-secondary/10 flex items-center gap-2">
          <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground">Your prediction: <span className="text-foreground font-bold">{bet.homeScore}–{bet.awayScore}</span></span>
        </div>
      )}

      {betOpen && !betLocked && (
        <div className="px-3 pb-3 pt-2 border-t border-border/40 bg-secondary/10 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="text-[11px] text-muted-foreground mb-3 text-center">Predict the final score</p>
          <div className="flex items-center justify-center gap-3">
            {/* Home score */}
            <div className="flex flex-col items-center gap-1">
              {homeFlag && <span className={`fi fi-${homeFlag} text-base`} />}
              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
                <button type="button" onClick={() => setHomeInput((v) => Math.max(0, v - 1))} className="px-2.5 py-1.5 text-lg font-bold text-muted-foreground hover:bg-accent">−</button>
                <span className="px-3 py-1.5 text-xl font-extrabold tabular-nums min-w-[2.5rem] text-center">{homeInput}</span>
                <button type="button" onClick={() => setHomeInput((v) => Math.min(20, v + 1))} className="px-2.5 py-1.5 text-lg font-bold text-muted-foreground hover:bg-accent">+</button>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground truncate max-w-[80px] text-center">{match.homeTeam}</span>
            </div>

            <span className="text-muted-foreground font-bold text-lg mb-4">–</span>

            {/* Away score */}
            <div className="flex flex-col items-center gap-1">
              {awayFlag && <span className={`fi fi-${awayFlag} text-base`} />}
              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
                <button type="button" onClick={() => setAwayInput((v) => Math.max(0, v - 1))} className="px-2.5 py-1.5 text-lg font-bold text-muted-foreground hover:bg-accent">−</button>
                <span className="px-3 py-1.5 text-xl font-extrabold tabular-nums min-w-[2.5rem] text-center">{awayInput}</span>
                <button type="button" onClick={() => setAwayInput((v) => Math.min(20, v + 1))} className="px-2.5 py-1.5 text-lg font-bold text-muted-foreground hover:bg-accent">+</button>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground truncate max-w-[80px] text-center">{match.awayTeam}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => setBetOpen(false)} className="flex-1 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-accent">
              Cancel
            </button>
            <button type="button" onClick={lockBet} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Lock In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

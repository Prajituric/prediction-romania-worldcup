import { Link } from "@tanstack/react-router";
import { Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getUser, isSubmitted } from "@/lib/wc/session";

const BET_REMINDER_KEY = "wc.betReminderLastShown";
const BET_REMINDER_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export function SiteHeader() {
  const [showMyPicks, setShowMyPicks] = useState(false);
  const [showBetReminder, setShowBetReminder] = useState(false);

  useEffect(() => {
    const user = getUser();
    setShowMyPicks(!!user);
    // Show bet reminder once per session for users with submitted picks
    if (user && isSubmitted()) {
      const last = parseInt(localStorage.getItem(BET_REMINDER_KEY) ?? "0");
      if (Date.now() - last > BET_REMINDER_COOLDOWN_MS) {
        setTimeout(() => setShowBetReminder(true), 1500);
      }
    }
  }, []);

  const dismissReminder = () => {
    localStorage.setItem(BET_REMINDER_KEY, Date.now().toString());
    setShowBetReminder(false);
  };

  return (
    <>
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-sm sm:text-base shrink-0">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="hidden xs:inline sm:inline">WC 2026</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <Link to="/schedule" className="hover:text-primary">Schedule</Link>
            <Link to="/predict/group" className="hover:text-primary">Groups</Link>
            <Link to="/predict/thirds" className="hover:text-primary">Thirds</Link>
            <Link to="/predict/bracket" className="hover:text-primary">Bracket</Link>
            {showMyPicks && <Link to="/my-picks" className="hover:text-primary font-medium text-primary">My Picks</Link>}
            <Link to="/leaderboard" className="hover:text-primary">Ranking</Link>
          </nav>
        </div>
      </header>

      {/* Bet reminder toast */}
      {showBetReminder && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/40 bg-card shadow-lg shadow-black/30 text-sm">
            <span className="text-xl">⚽</span>
            <span>
              <span className="font-semibold text-foreground">Nu uitați să dați bet!</span>
              <span className="text-muted-foreground ml-1">Pariați scorurile pe</span>{" "}
              <Link to="/schedule" onClick={dismissReminder} className="text-primary font-semibold hover:underline">
                Schedule
              </Link>
            </span>
            <button onClick={dismissReminder} className="ml-1 p-1 rounded hover:bg-accent text-muted-foreground shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

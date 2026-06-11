import { Link, useNavigate } from "@tanstack/react-router";
import { Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getUser, isSubmitted } from "@/lib/wc/session";

const BET_REMINDER_KEY = "wc.betReminderLastShown";
const BET_REMINDER_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export function SiteHeader() {
  const navigate = useNavigate();
  const [showMyPicks, setShowMyPicks] = useState(false);
  const [step, setStep] = useState<"hidden" | "reminder" | "confirm">("hidden");

  useEffect(() => {
    const user = getUser();
    setShowMyPicks(!!user);
    if (user) {
      const last = parseInt(localStorage.getItem(BET_REMINDER_KEY) ?? "0");
      if (Date.now() - last > BET_REMINDER_COOLDOWN_MS) {
        setTimeout(() => setStep("reminder"), 1500);
      }
    }
  }, []);

  const saveCooldown = () => localStorage.setItem(BET_REMINDER_KEY, Date.now().toString());

  const onDismissReminder = () => setStep("confirm");

  const onConfirmYes = () => { saveCooldown(); setStep("hidden"); };

  const onConfirmNo = () => { saveCooldown(); setStep("hidden"); navigate({ to: "/schedule" }); };

  const isOpen = step !== "hidden";

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

      {/* Modal overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-primary/30 bg-card shadow-2xl animate-in zoom-in-95 duration-200">

            {step === "reminder" && (
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <span className="text-5xl">⚽</span>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Nu uitați să dați bet!</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Pariați scorurile meciurilor pe pagina Schedule și câștigați puncte bonus.
                  </p>
                </div>
                <div className="flex gap-3 w-full pt-1">
                  <button
                    onClick={onDismissReminder}
                    className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent"
                  >
                    <X className="h-3.5 w-3.5 inline mr-1" /> Închide
                  </button>
                  <Link
                    to="/schedule"
                    onClick={() => { saveCooldown(); setStep("hidden"); }}
                    className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold text-center hover:bg-primary/90"
                  >
                    Mergi la Schedule →
                  </Link>
                </div>
              </div>
            )}

            {step === "confirm" && (
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <span className="text-5xl">🤔</span>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Ai dat bet?</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Asigură-te că ai pariat pe meciurile de azi!
                  </p>
                </div>
                <div className="flex gap-3 w-full pt-1">
                  <button
                    onClick={onConfirmYes}
                    className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90"
                  >
                    Da ✓
                  </button>
                  <button
                    onClick={onConfirmNo}
                    className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent"
                  >
                    Nu → Schedule
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}

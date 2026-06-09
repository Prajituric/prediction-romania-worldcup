import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-sm sm:text-base shrink-0">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="hidden xs:inline sm:inline">WC 2026</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          <Link to="/predict/group" className="hover:text-primary">Groups</Link>
          <Link to="/predict/bracket" className="hover:text-primary">Bracket</Link>
          <Link to="/leaderboard" className="hover:text-primary">Ranking</Link>
          <Link to="/admin/results" className="hover:text-primary text-muted-foreground hidden sm:inline">Admin</Link>
        </nav>
      </div>
    </header>
  );
}

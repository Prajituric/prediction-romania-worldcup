import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Trophy className="h-5 w-5 text-primary" />
          <span>WC 2026 Bracket</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/predict/group" className="hover:text-primary">Groups</Link>
          <Link to="/predict/bracket" className="hover:text-primary">Bracket</Link>
          <Link to="/leaderboard" className="hover:text-primary">Leaderboard</Link>
          <Link to="/admin/results" className="hover:text-primary text-muted-foreground">Admin</Link>
        </nav>
      </div>
    </header>
  );
}

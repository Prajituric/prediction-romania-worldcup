import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { registerUser, getUserPrediction } from "@/lib/wc/predictions.functions";
import { setUser, getUser, setSubmitted, saveGroups, savePicks } from "@/lib/wc/session";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "World Cup 2026 Bracket Predictor" },
      { name: "description", content: "Predict the 2026 FIFA World Cup: rank all 12 groups and fill out the full 32-team knockout bracket." },
      { property: "og:title", content: "World Cup 2026 Bracket Predictor" },
      { property: "og:description", content: "Rank all 12 groups and predict the full 32-team knockout bracket." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const register = useServerFn(registerUser);
  const fetchPrediction = useServerFn(getUserPrediction);
  const existing = typeof window !== "undefined" ? getUser() : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await register({ data: { name: name.trim() } });
      const prev = getUser();
      if (!prev || prev.userId !== res.userId) {
        // New user on this device — reset local progress + submission lock.
        setSubmitted(false);
        saveGroups({});
        savePicks({});
      }
      setUser({ userId: res.userId, name: res.name });
      // Check if this user already has a prediction in DB — if so, go straight to My Picks
      const existingPrediction = await fetchPrediction({ data: { userId: res.userId } });
      if (existingPrediction) {
        setSubmitted(true);
        navigate({ to: "/my-picks" });
      } else {
        navigate({ to: "/predict/group" });
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to register.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6">
          <Trophy className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Hai cu predictiile alea!!!
        </h1>
        <p className="mt-4 text-muted-foreground text-lg">
          Hai sa castige Senegal
        </p>

        <form onSubmit={submit} className="mt-10 max-w-md mx-auto flex flex-col gap-3">
          <label className="text-left text-sm font-medium">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            className="px-4 py-3 rounded-md border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
            minLength={2}
            maxLength={60}
          />
          {error && <p className="text-sm text-destructive text-left">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Starting…" : "Start predicting"}
          </button>
        </form>
      </main>
    </div>
  );
}

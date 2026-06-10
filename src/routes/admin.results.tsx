import { createFileRoute, redirect } from "@tanstack/react-router";

// Results are now driven exclusively by the sync-wc-results Supabase Edge Function
// which fetches live data from football-data.org. Manual admin entry is no longer needed.
export const Route = createFileRoute("/admin/results")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
  component: () => null,
});

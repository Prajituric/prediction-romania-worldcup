import { createFileRoute } from "@tanstack/react-router";

// 4-hour-before-kickoff push reminders for users who haven't bet yet.
// Called by pg_cron every 15 minutes; idempotent via notified_matches table.

const REMINDER_HOURS_BEFORE = 4;
const WINDOW_MINUTES = 20; // matches between [N-10min, N+10min] from target

const API_NAME_MAP: Record<string, string> = {
  "Türkiye": "Turkiye",
  "Turkey": "Turkiye",
  "Côte d'Ivoire": "Ivory Coast",
  "Congo DR": "DR Congo",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "South Korea": "Korea Republic",
  "USA": "United States",
  "Cape Verde Islands": "Cape Verde",
};
const normalize = (n: string) => API_NAME_MAP[n] ?? n;

export const Route = createFileRoute("/api/public/hooks/send-match-reminders")({
  server: {
    handlers: {
      POST: handler,
      GET: handler, // allow manual testing
    },
  },
});

async function handler() {
  const footballToken = process.env.FOOTBALL_API_TOKEN;
  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (!footballToken) return jsonResp({ ok: false, error: "FOOTBALL_API_TOKEN missing" }, 500);
  if (!vapidPublic || !vapidPrivate) return jsonResp({ ok: false, error: "VAPID keys missing" }, 500);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  // 1. Fetch upcoming matches from football-data API
  const res = await fetch(
    "https://api.football-data.org/v4/competitions/WC/matches?season=2026&status=SCHEDULED,TIMED",
    { headers: { "X-Auth-Token": footballToken } },
  );
  if (!res.ok) {
    return jsonResp({ ok: false, error: `API ${res.status}` }, 502);
  }
  const apiData = await res.json();

  const now = Date.now();
  const targetMs = REMINDER_HOURS_BEFORE * 60 * 60 * 1000;
  const halfWindow = (WINDOW_MINUTES / 2) * 60 * 1000;

  // 2. Pick matches whose kickoff is in [4h - window/2, 4h + window/2]
  const candidates = (apiData.matches ?? []).filter((m: any) => {
    const kickoff = new Date(m.utcDate).getTime();
    const delta = kickoff - now;
    return delta >= targetMs - halfWindow && delta <= targetMs + halfWindow;
  });

  if (candidates.length === 0) {
    return jsonResp({ ok: true, message: "no matches in window", checked: apiData.matches?.length ?? 0 });
  }

  // 3. Skip already-notified
  const matchIds = candidates.map((m: any) => m.id);
  const { data: alreadySent } = await supabaseAdmin
    .from("notified_matches")
    .select("match_id")
    .in("match_id", matchIds);
  const sentSet = new Set((alreadySent ?? []).map((r: any) => r.match_id));
  const toNotify = candidates.filter((m: any) => !sentSet.has(m.id));

  if (toNotify.length === 0) {
    return jsonResp({ ok: true, message: "all in window already notified", candidates: candidates.length });
  }

  // 4. Load all subscriptions once
  const { data: allSubs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");

  const subsByUser = new Map<number, typeof allSubs>();
  for (const s of allSubs ?? []) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, [] as any);
    subsByUser.get(s.user_id)!.push(s);
  }
  const allUserIds = [...subsByUser.keys()];

  let totalPushes = 0;
  let totalFailures = 0;
  const matchSummaries: any[] = [];

  for (const match of toNotify) {
    const home = normalize(match.homeTeam?.name ?? "TBD");
    const away = normalize(match.awayTeam?.name ?? "TBD");

    // Find users who HAVE a bet on this match → exclude them
    const { data: bettedUsers } = await supabaseAdmin
      .from("bets")
      .select("user_id")
      .eq("match_id", match.id)
      .in("user_id", allUserIds);
    const betSet = new Set((bettedUsers ?? []).map((b: any) => b.user_id));
    const targetUserIds = allUserIds.filter((uid) => !betSet.has(uid));

    const payload = JSON.stringify({
      title: "⚽ Match starting soon!",
      body: `${home} vs ${away} starts in 4 hours — place your bet!`,
      url: "/schedule",
    });

    let matchPushes = 0;
    let matchFailures = 0;
    for (const uid of targetUserIds) {
      for (const sub of subsByUser.get(uid) ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          matchPushes++;
        } catch (err: any) {
          matchFailures++;
          // Clean up dead subscriptions (410 Gone / 404)
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }
    }

    totalPushes += matchPushes;
    totalFailures += matchFailures;

    // Mark match as notified (even if 0 pushes, so we don't retry forever)
    await supabaseAdmin.from("notified_matches").insert({ match_id: match.id });
    matchSummaries.push({ matchId: match.id, home, away, pushes: matchPushes, failures: matchFailures, targets: targetUserIds.length });
  }

  return jsonResp({
    ok: true,
    matchesNotified: toNotify.length,
    totalPushes,
    totalFailures,
    matches: matchSummaries,
  });
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

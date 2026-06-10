import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { getUser } from "@/lib/wc/session";
import {
  isPushSupported,
  getCurrentPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/wc/pushClient";

type Variant = "icon" | "banner";

export function PushBell({ variant = "icon" }: { variant?: Variant }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const u = getUser();
    setUserId(u?.userId ?? null);
    setSupported(isPushSupported());
    setDismissed(typeof window !== "undefined" && localStorage.getItem("push.banner.dismissed") === "1");
    (async () => {
      const sub = await getCurrentPushSubscription();
      setSubscribed(!!sub);
    })();
  }, []);

  if (!supported) return null;
  if (!userId) return null;

  const toggle = async () => {
    setBusy(true);
    setHint(null);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        const res = await subscribeToPush(userId);
        if (res.ok) {
          setSubscribed(true);
        } else {
          setHint(res.reason ?? "Could not enable notifications.");
        }
      }
    } catch (err: any) {
      setHint(err?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("push.banner.dismissed", "1");
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={subscribed ? "Disable match reminders" : "Enable match reminders"}
        className={[
          "relative p-1.5 rounded-md transition",
          subscribed ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent",
          busy ? "opacity-50" : "",
        ].join(" ")}
      >
        {subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        {subscribed && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
      </button>
    );
  }

  // banner
  if (subscribed || dismissed) return null;
  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3">
      <Bell className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">Get a heads-up 4 hours before kickoff</div>
        <div className="text-xs text-muted-foreground">We'll ping you for matches you haven't bet on yet.</div>
        {hint && <div className="text-xs text-red-400 mt-1">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 shrink-0"
      >
        {busy ? "…" : "Enable"}
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="text-xs text-muted-foreground hover:text-foreground px-2"
      >
        ✕
      </button>
    </div>
  );
}

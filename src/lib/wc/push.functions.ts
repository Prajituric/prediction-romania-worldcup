import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: number; endpoint: string; p256dh: string; auth: string }) => {
    if (!d || typeof d.userId !== "number") throw new Error("Missing userId.");
    if (!d.endpoint || typeof d.endpoint !== "string") throw new Error("Missing endpoint.");
    if (!d.p256dh || !d.auth) throw new Error("Missing keys.");
    return d;
  })
  .handler(async ({ data }) => {
    // Upsert by endpoint (endpoint is unique per browser/install)
    const existing = await supabaseAdmin
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", data.endpoint)
      .maybeSingle();

    if (existing.data) {
      const upd = await supabaseAdmin
        .from("push_subscriptions")
        .update({ user_id: data.userId, p256dh: data.p256dh, auth: data.auth })
        .eq("id", existing.data.id);
      if (upd.error) throw new Error(upd.error.message);
    } else {
      const ins = await supabaseAdmin.from("push_subscriptions").insert({
        user_id: data.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
      });
      if (ins.error) throw new Error(ins.error.message);
    }
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((d: { endpoint: string }) => {
    if (!d?.endpoint) throw new Error("Missing endpoint.");
    return d;
  })
  .handler(async ({ data }) => {
    await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const isPushSubscribed = createServerFn({ method: "POST" })
  .inputValidator((d: { endpoint: string }) => d)
  .handler(async ({ data }) => {
    if (!data?.endpoint) return false;
    const { data: row } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", data.endpoint)
      .maybeSingle();
    return !!row;
  });

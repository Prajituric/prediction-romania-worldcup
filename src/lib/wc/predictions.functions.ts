import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ALL_KO_IDS, GROUPS, GROUP_LETTERS, type GroupRankings, type KnockoutPicks } from "./groupsData";
import { buildFullBracket } from "./bracketResolver";

function validateGroupRankings(gr: any): gr is GroupRankings {
  if (!gr || typeof gr !== "object") return false;
  for (const g of GROUP_LETTERS) {
    const arr = gr[g];
    if (!Array.isArray(arr) || arr.length !== 4) return false;
    const teams = GROUPS[g];
    const set = new Set(arr);
    if (set.size !== 4) return false;
    for (const t of arr) if (!teams.includes(t)) return false;
  }
  return true;
}

export const registerUser = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string }) => {
    const name = (d?.name ?? "").trim();
    if (name.length < 2 || name.length > 60) throw new Error("Name must be 2-60 characters.");
    return { name };
  })
  .handler(async ({ data }) => {
    const existing = await supabaseAdmin.from("users").select("id,name").ilike("name", data.name).maybeSingle();
    if (existing.data) return { userId: existing.data.id as number, name: existing.data.name as string };
    const ins = await supabaseAdmin.from("users").insert({ name: data.name }).select("id,name").single();
    if (ins.error) throw new Error(ins.error.message);
    return { userId: ins.data!.id as number, name: ins.data!.name as string };
  });

export const savePredictions = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: number; groupRankings: GroupRankings; knockoutPicks: KnockoutPicks }) => {
    if (!d || typeof d.userId !== "number") throw new Error("Missing userId.");
    if (!validateGroupRankings(d.groupRankings)) throw new Error("Invalid group rankings.");
    if (!d.knockoutPicks || typeof d.knockoutPicks !== "object") throw new Error("Invalid knockout picks.");
    return d;
  })
  .handler(async ({ data }) => {
    // Compute points if actual results exist
    const actual = await supabaseAdmin.from("actual_results").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    let points = 0;
    if (actual.data) {
      const ko = actual.data.knockout_results_actual as Record<string, string>;
      for (const id of ALL_KO_IDS) {
        if (ko[id] && data.knockoutPicks[id] && ko[id] === data.knockoutPicks[id]) points++;
      }
    }

    const existing = await supabaseAdmin.from("predictions").select("id").eq("user_id", data.userId).maybeSingle();
    if (existing.data) {
      const upd = await supabaseAdmin.from("predictions").update({
        group_rankings: data.groupRankings,
        knockout_picks: data.knockoutPicks,
        points,
      }).eq("id", existing.data.id);
      if (upd.error) throw new Error(upd.error.message);
    } else {
      const ins = await supabaseAdmin.from("predictions").insert({
        user_id: data.userId,
        group_rankings: data.groupRankings,
        knockout_picks: data.knockoutPicks,
        points,
      });
      if (ins.error) throw new Error(ins.error.message);
    }
    return { ok: true, points };
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("predictions")
    .select("points, user_id, users(name)")
    .order("points", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    name: r.users?.name ?? "Unknown",
    points: r.points ?? 0,
  }));
});

export const getUserPrediction = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: number }) => d)
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("predictions")
      .select("group_rankings, knockout_picks, points")
      .eq("user_id", data.userId)
      .maybeSingle();
    return row
      ? { groupRankings: row.group_rankings, knockoutPicks: row.knockout_picks, points: row.points }
      : null;
  });

export const getActualResults = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("actual_results")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? {
        groupRankings: data.group_rankings_actual as GroupRankings,
        knockoutResults: data.knockout_results_actual as KnockoutPicks,
      }
    : null;
});

export const adminSetActualResults = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; groupActual: GroupRankings; knockoutActual: KnockoutPicks }) => {
    const expected = process.env.VITE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (!expected || d.password !== expected) throw new Error("Invalid admin password.");
    if (!validateGroupRankings(d.groupActual)) throw new Error("Invalid actual group rankings.");
    return d;
  })
  .handler(async ({ data }) => {
    // Upsert single-row results (keep one row)
    await supabaseAdmin.from("actual_results").delete().neq("id", -1);
    const ins = await supabaseAdmin.from("actual_results").insert({
      group_rankings_actual: data.groupActual,
      knockout_results_actual: data.knockoutActual,
    });
    if (ins.error) throw new Error(ins.error.message);

    // Recalculate all
    const all = await supabaseAdmin.from("predictions").select("id, knockout_picks");
    if (all.data) {
      for (const row of all.data as any[]) {
        let points = 0;
        const picks = row.knockout_picks as KnockoutPicks;
        for (const id of ALL_KO_IDS) {
          if (data.knockoutActual[id] && picks[id] && data.knockoutActual[id] === picks[id]) points++;
        }
        await supabaseAdmin.from("predictions").update({ points }).eq("id", row.id);
      }
    }
    return { ok: true };
  });

// Resolve the full bracket from rankings + picks, used to drive admin's KO dropdowns from the actual group standings.
export const resolveBracketFromActual = createServerFn({ method: "POST" })
  .inputValidator((d: { groupRankings: GroupRankings; picks: KnockoutPicks }) => d)
  .handler(async ({ data }) => {
    return buildFullBracket(data.groupRankings, data.picks);
  });

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { GROUPS, GROUP_LETTERS, R32_IDS, R16_IDS, QF_IDS, SF_IDS, FINAL_ID, ALL_KO_IDS } from "@/lib/wc/groupsData";
import { buildFullBracket } from "@/lib/wc/bracketResolver";
import { adminSetActualResults, getActualResults } from "@/lib/wc/predictions.functions";
import { SiteHeader } from "@/components/wc/SiteHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/results")({
  head: () => ({ meta: [{ title: "Admin — Set Actual Results" }] }),
  component: AdminResults,
});

const POSITIONS = [1, 2, 3, 4] as const;

function AdminResults() {
  const expected = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);

  const fetchActual = useServerFn(getActualResults);
  const saveActual = useServerFn(adminSetActualResults);

  const [groupActual, setGroupActual] = useState<Record<string, string[]>>(() => {
    const d: Record<string, string[]> = {};
    for (const L of GROUP_LETTERS) d[L] = [...GROUPS[L]];
    return d;
  });
  const [koActual, setKoActual] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      const cur = await fetchActual();
      if (cur) {
        setGroupActual(cur.groupRankings as Record<string, string[]>);
        setKoActual(cur.knockoutResults as Record<string, string>);
      }
    })();
  }, [authed, fetchActual]);

  const bracket = useMemo(() => buildFullBracket(groupActual, koActual), [groupActual, koActual]);
  const matchById = useMemo(() => Object.fromEntries(bracket.map((m) => [m.id, m])), [bracket]);

  const setGroupPos = (g: string, pos: number, team: string) => {
    const arr = [...groupActual[g]];
    const currentIdx = arr.indexOf(team);
    const targetIdx = pos - 1;
    if (currentIdx === -1) return;
    [arr[targetIdx], arr[currentIdx]] = [arr[currentIdx], arr[targetIdx]];
    setGroupActual({ ...groupActual, [g]: arr });
    setKoActual({}); // invalidate KO picks since bracket may shift
  };

  const setKoWinner = (id: string, team: string) => {
    const next = { ...koActual, [id]: team };
    // clear downstream
    const downstream: Record<string, string> = {};
    const pairs = [
      [R32_IDS, R16_IDS],
      [R16_IDS, QF_IDS],
      [QF_IDS, SF_IDS],
      [SF_IDS, [FINAL_ID]],
    ] as const;
    for (const [src, dst] of pairs)
      for (let i = 0; i < dst.length; i++) {
        downstream[src[i * 2]] = dst[i];
        downstream[src[i * 2 + 1]] = dst[i];
      }
    let cur = id;
    while (downstream[cur]) {
      const child = downstream[cur];
      if (next[child]) delete next[child];
      cur = child;
    }
    setKoActual(next);
  };

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expected) { toast.error("VITE_ADMIN_PASSWORD not configured."); return; }
    if (pw === expected) setAuthed(true);
    else toast.error("Wrong password.");
  };

  const submit = async () => {
    setSaving(true);
    try {
      await saveActual({ data: { password: pw, groupActual, knockoutActual: koActual } });
      toast.success("Actual results saved. All users' points recalculated.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="max-w-md mx-auto px-4 py-16">
          <h1 className="text-2xl font-bold mb-4">Admin login</h1>
          <form onSubmit={login} className="flex flex-col gap-3">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Admin password"
              className="px-4 py-3 rounded-md border border-input bg-card"
            />
            <button className="px-4 py-3 rounded-md bg-primary text-primary-foreground">Enter</button>
          </form>
        </main>
      </div>
    );
  }

  const renderKoCol = (ids: string[], title: string) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{title}</h3>
      {ids.map((id) => {
        const m = matchById[id];
        if (!m) return null;
        const options = [m.team1, m.team2].filter(Boolean) as string[];
        return (
          <div key={id} className="rounded border border-border p-2 bg-card">
            <div className="text-[10px] font-mono text-muted-foreground mb-1">{id}</div>
            <select
              value={m.winner ?? ""}
              onChange={(e) => setKoWinner(id, e.target.value)}
              className="w-full text-sm px-2 py-1.5 bg-background border border-border rounded"
              disabled={options.length < 2}
            >
              <option value="">— winner —</option>
              {options.map((t) => <option key={t} value={t!}>{t}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Admin — Actual Results</h1>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save & recalculate"}
          </button>
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Actual group standings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GROUP_LETTERS.map((g) => (
              <div key={g} className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold mb-2">Group {g}</h3>
                {POSITIONS.map((pos) => (
                  <div key={pos} className="flex items-center gap-2 mb-1.5">
                    <span className="w-6 text-xs font-mono text-muted-foreground">{pos}.</span>
                    <select
                      value={groupActual[g][pos - 1]}
                      onChange={(e) => setGroupPos(g, pos, e.target.value)}
                      className="flex-1 text-sm px-2 py-1 bg-background border border-border rounded"
                    >
                      {GROUPS[g].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Actual knockout winners</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Matchups are derived from your group standings above. Pick the winner of each match — winners advance automatically.
          </p>
          <div className="overflow-x-auto">
            <div className="flex gap-6 min-w-fit">
              {renderKoCol(R32_IDS, "Round of 32")}
              {renderKoCol(R16_IDS, "Round of 16")}
              {renderKoCol(QF_IDS, "Quarter-finals")}
              {renderKoCol(SF_IDS, "Semi-finals")}
              {renderKoCol([FINAL_ID], "Final")}
            </div>
          </div>
        </section>

        <div className="mt-8 flex justify-end">
          <button onClick={submit} disabled={saving} className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save & recalculate"}
          </button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Saved {Object.keys(koActual).length}/{ALL_KO_IDS.length} knockout winners.
        </p>
      </main>
    </div>
  );
}

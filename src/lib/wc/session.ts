// Lightweight client-side "session" — name-only, no auth
// Set to true to allow all users to re-edit their picks (revert to false to lock after WC starts)
export const EDITING_OPEN = false;
const USER_KEY = "wc.user";
const GROUPS_KEY = "wc.groupRankings";
const PICKS_KEY = "wc.knockoutPicks";
const THIRDS_KEY = "wc.thirds";
const SUBMITTED_KEY = "wc.submitted";

export function isSubmitted(): boolean {
  if (EDITING_OPEN) return false; // editing window: treat everyone as unlocked
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SUBMITTED_KEY) === "1";
}
export function setSubmitted(v: boolean) {
  if (v) localStorage.setItem(SUBMITTED_KEY, "1");
  else localStorage.removeItem(SUBMITTED_KEY);
}

export interface LocalUser { userId: number; name: string }

export function getUser(): LocalUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as LocalUser) : null;
  } catch { return null; }
}
export function setUser(u: LocalUser) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
export function clearUser() { localStorage.removeItem(USER_KEY); }

export function loadGroups(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "{}"); } catch { return {}; }
}
export function saveGroups(g: Record<string, string[]>) { localStorage.setItem(GROUPS_KEY, JSON.stringify(g)); }

export function loadPicks(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(PICKS_KEY) ?? "{}"); } catch { return {}; }
}
export function savePicks(p: Record<string, string>) { localStorage.setItem(PICKS_KEY, JSON.stringify(p)); }

export function loadThirds(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(THIRDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch { return null; }
}
export function saveThirds(t: string[]) { localStorage.setItem(THIRDS_KEY, JSON.stringify(t)); }

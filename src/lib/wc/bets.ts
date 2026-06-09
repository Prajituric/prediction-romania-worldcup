const BETS_KEY = "wc.bets";

export interface Bet {
  homeScore: number;
  awayScore: number;
}

export function loadBets(): Record<number, Bet> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(BETS_KEY) ?? "{}"); } catch { return {}; }
}

export function saveBet(matchId: number, bet: Bet) {
  const all = loadBets();
  all[matchId] = bet;
  localStorage.setItem(BETS_KEY, JSON.stringify(all));
}

export function getBet(matchId: number): Bet | null {
  return loadBets()[matchId] ?? null;
}

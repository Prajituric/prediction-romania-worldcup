export const GROUPS: Record<string, string[]> = {
  A: ["Mexico", "South Africa", "Korea Republic", "Czechia"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Turkiye"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

export const GROUP_LETTERS = Object.keys(GROUPS);

export const POSITION_POINTS: Record<number, number> = { 1: 9, 2: 7, 3: 4, 4: 0 };

export type GroupRankings = Record<string, string[]>; // letter -> [1st,2nd,3rd,4th]
export type KnockoutPicks = Record<string, string>;   // matchId -> team

// Knockout match ids in bracket order
export const R32_IDS = Array.from({ length: 16 }, (_, i) => `R32_${i + 1}`);
export const R16_IDS = Array.from({ length: 8 }, (_, i) => `R16_${i + 1}`);
export const QF_IDS = Array.from({ length: 4 }, (_, i) => `QF_${i + 1}`);
export const SF_IDS = Array.from({ length: 2 }, (_, i) => `SF_${i + 1}`);
export const FINAL_ID = "FINAL";
export const ALL_KO_IDS = [...R32_IDS, ...R16_IDS, ...QF_IDS, ...SF_IDS, FINAL_ID];

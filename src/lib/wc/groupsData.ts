export const GROUPS: Record<string, string[]> = {
  A: ["Korea Republic", "Switzerland", "Brazil", "Mexico"],
  B: ["Canada", "Morocco", "Czechia", "Qatar"],
  C: ["Scotland", "South Africa", "Bosnia-Herzegovina", "Haiti"],
  D: ["Turkiye", "Germany", "Netherlands", "Paraguay"],
  E: ["Ecuador", "Japan", "Australia", "Ivory Coast"],
  F: ["Tunisia", "USA", "Curacao", "Sweden"],
  G: ["Belgium", "Spain", "France", "Egypt"],
  H: ["Uruguay", "Norway", "New Zealand", "Saudi Arabia"],
  I: ["Senegal", "Iran", "Cabo Verde", "Iraq"],
  J: ["Argentina", "Portugal", "England", "Austria"],
  K: ["Colombia", "Croatia", "Jordan", "Uzbekistan"],
  L: ["Ghana", "Algeria", "DR Congo", "Panama"],
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

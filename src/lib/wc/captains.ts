export const CAPTAINS: Record<string, string> = {
  // Group A
  "Mexico": "Edson Álvarez",
  "South Africa": "Ronwen Williams",
  "Korea Republic": "Son Heung-min",
  "Czechia": "Tomáš Souček",
  // Group B
  "Canada": "Alphonso Davies",
  "Bosnia and Herzegovina": "Edin Džeko",
  "Qatar": "Hassan Al-Haydos",
  "Switzerland": "Granit Xhaka",
  // Group C
  "Brazil": "Marquinhos",
  "Morocco": "Romain Saïss",
  "Haiti": "Wilde-Donald Guerrier",
  "Scotland": "Andy Robertson",
  // Group D
  "United States": "Christian Pulisic",
  "Paraguay": "Gustavo Gómez",
  "Australia": "Mat Ryan",
  "Turkiye": "Hakan Çalhanoğlu",
  // Group E
  "Germany": "Joshua Kimmich",
  "Curaçao": "Leandro Bacuna",
  "Ivory Coast": "Franck Kessié",
  "Ecuador": "Enner Valencia",
  // Group F
  "Netherlands": "Virgil van Dijk",
  "Japan": "Wataru Endō",
  "Sweden": "Victor Nilsson Lindelöf",
  "Tunisia": "Youssef Msakni",
  // Group G
  "Belgium": "Kevin De Bruyne",
  "Egypt": "Mohamed Salah",
  "Iran": "Ehsan Hajsafi",
  "New Zealand": "Tommy Smith",
  // Group H
  "Spain": "Álvaro Morata",
  "Cape Verde": "Nuno Tavares",
  "Saudi Arabia": "Salem Al-Dawsari",
  "Uruguay": "José María Giménez",
  // Group I
  "France": "Kylian Mbappé",
  "Senegal": "Kalidou Koulibaly",
  "Iraq": "Mohanad Ali",
  "Norway": "Martin Ødegaard",
  // Group J
  "Argentina": "Lionel Messi",
  "Algeria": "Riyad Mahrez",
  "Austria": "David Alaba",
  "Jordan": "Baha' Faisal",
  // Group K
  "Portugal": "Cristiano Ronaldo",
  "DR Congo": "Chancel Mbemba",
  "Uzbekistan": "Eldor Shomurodov",
  "Colombia": "Davinson Sánchez",
  // Group L
  "England": "Harry Kane",
  "Croatia": "Luka Modrić",
  "Ghana": "Thomas Partey",
  "Panama": "Anibal Godoy",
};

export function getCaptain(team: string): string | null {
  return CAPTAINS[team] ?? null;
}

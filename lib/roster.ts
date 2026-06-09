/**
 * Full modern-era justice roster (1946–present) for the Immaculate Bench game.
 * Keyed by SCDB justiceName. Service spans are first/last argued term in SCDB.
 * (The homepage wall uses the separate current-9 list in justices.ts.)
 */
export interface RosterJustice {
  /** SCDB justiceName, e.g. "WJBrennan" */
  id: string;
  /** display label (disambiguated where last names collide) */
  display: string;
  firstTerm: number;
  lastTerm: number;
}

export const ROSTER: RosterJustice[] = [
  { id: "HHBurton", display: "Burton", firstTerm: 1946, lastTerm: 1958 },
  { id: "RHJackson", display: "R. Jackson", firstTerm: 1946, lastTerm: 1953 },
  { id: "WODouglas", display: "Douglas", firstTerm: 1946, lastTerm: 1975 },
  { id: "FFrankfurter", display: "Frankfurter", firstTerm: 1946, lastTerm: 1961 },
  { id: "SFReed", display: "Reed", firstTerm: 1946, lastTerm: 1956 },
  { id: "HLBlack", display: "Black", firstTerm: 1946, lastTerm: 1970 },
  { id: "WBRutledge", display: "Rutledge", firstTerm: 1946, lastTerm: 1948 },
  { id: "FMurphy", display: "Murphy", firstTerm: 1946, lastTerm: 1948 },
  { id: "FMVinson", display: "Vinson", firstTerm: 1946, lastTerm: 1952 },
  { id: "TCClark", display: "Clark", firstTerm: 1949, lastTerm: 1966 },
  { id: "SMinton", display: "Minton", firstTerm: 1949, lastTerm: 1956 },
  { id: "EWarren", display: "Warren", firstTerm: 1953, lastTerm: 1968 },
  { id: "JHarlan2", display: "Harlan", firstTerm: 1954, lastTerm: 1970 },
  { id: "WJBrennan", display: "Brennan", firstTerm: 1956, lastTerm: 1989 },
  { id: "CEWhittaker", display: "Whittaker", firstTerm: 1956, lastTerm: 1961 },
  { id: "PStewart", display: "Stewart", firstTerm: 1958, lastTerm: 1980 },
  { id: "BRWhite", display: "White", firstTerm: 1961, lastTerm: 1992 },
  { id: "AJGoldberg", display: "Goldberg", firstTerm: 1962, lastTerm: 1964 },
  { id: "AFortas", display: "Fortas", firstTerm: 1965, lastTerm: 1968 },
  { id: "TMarshall", display: "Marshall", firstTerm: 1967, lastTerm: 1990 },
  { id: "WEBurger", display: "Burger", firstTerm: 1969, lastTerm: 1985 },
  { id: "HABlackmun", display: "Blackmun", firstTerm: 1969, lastTerm: 1993 },
  { id: "LFPowell", display: "Powell", firstTerm: 1971, lastTerm: 1986 },
  { id: "WHRehnquist", display: "Rehnquist", firstTerm: 1971, lastTerm: 2004 },
  { id: "JPStevens", display: "Stevens", firstTerm: 1975, lastTerm: 2009 },
  { id: "SDOConnor", display: "O'Connor", firstTerm: 1981, lastTerm: 2005 },
  { id: "AScalia", display: "Scalia", firstTerm: 1986, lastTerm: 2015 },
  { id: "AMKennedy", display: "Kennedy", firstTerm: 1987, lastTerm: 2017 },
  { id: "DHSouter", display: "Souter", firstTerm: 1990, lastTerm: 2008 },
  { id: "CThomas", display: "Thomas", firstTerm: 1991, lastTerm: 2024 },
  { id: "RBGinsburg", display: "Ginsburg", firstTerm: 1993, lastTerm: 2019 },
  { id: "SGBreyer", display: "Breyer", firstTerm: 1994, lastTerm: 2021 },
  { id: "JGRoberts", display: "Roberts", firstTerm: 2005, lastTerm: 2024 },
  { id: "SAAlito", display: "Alito", firstTerm: 2005, lastTerm: 2024 },
  { id: "SSotomayor", display: "Sotomayor", firstTerm: 2009, lastTerm: 2024 },
  { id: "EKagan", display: "Kagan", firstTerm: 2010, lastTerm: 2024 },
  { id: "NMGorsuch", display: "Gorsuch", firstTerm: 2016, lastTerm: 2024 },
  { id: "BMKavanaugh", display: "Kavanaugh", firstTerm: 2018, lastTerm: 2024 },
  { id: "ACBarrett", display: "Barrett", firstTerm: 2020, lastTerm: 2024 },
  { id: "KBJackson", display: "Jackson", firstTerm: 2022, lastTerm: 2024 },
];

export const ROSTER_BY_ID: Record<string, RosterJustice> = Object.fromEntries(
  ROSTER.map((j) => [j.id, j])
);

export const justiceLabel = (id: string) => ROSTER_BY_ID[id]?.display ?? id;

/**
 * Justices eligible to appear as game headers / authorship categories: the
 * last 20 to sit (current 9 + the 11 before them, back to Marshall). Cases
 * from older eras remain valid answers via topic/era/margin categories.
 */
export const GAME_JUSTICES = [...ROSTER]
  .sort((a, b) => b.lastTerm - a.lastTerm || b.firstTerm - a.firstTerm)
  .slice(0, 20);

export const GAME_JUSTICE_IDS = new Set(GAME_JUSTICES.map((j) => j.id));

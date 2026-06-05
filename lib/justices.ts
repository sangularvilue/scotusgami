export interface Justice {
  /** Oyez member identifier */
  id: string;
  lastName: string;
  fullName: string;
  /** Common shorthand initials */
  short: string;
  /** 0-based seniority index (Chief first, then by appointment date) */
  seniority: number;
  /** 0-based ideological display index (left to right) */
  ideology: number;
}

/**
 * The current natural court: every case decided since Justice Jackson
 * joined (June 30, 2022) was decided by these nine.
 * Array is in SENIORITY order — this order defines lineup-key positions.
 */
export const JUSTICES: Justice[] = [
  { id: "john_g_roberts_jr",     lastName: "Roberts",   fullName: "John G. Roberts, Jr.",  short: "JR",  seniority: 0, ideology: 3 },
  { id: "clarence_thomas",       lastName: "Thomas",    fullName: "Clarence Thomas",       short: "CT",  seniority: 1, ideology: 8 },
  { id: "samuel_a_alito_jr",     lastName: "Alito",     fullName: "Samuel A. Alito, Jr.",  short: "SA",  seniority: 2, ideology: 7 },
  { id: "sonia_sotomayor",       lastName: "Sotomayor", fullName: "Sonia Sotomayor",       short: "SS",  seniority: 3, ideology: 0 },
  { id: "elena_kagan",           lastName: "Kagan",     fullName: "Elena Kagan",           short: "EK",  seniority: 4, ideology: 1 },
  { id: "neil_gorsuch",          lastName: "Gorsuch",   fullName: "Neil Gorsuch",          short: "NG",  seniority: 5, ideology: 6 },
  { id: "brett_m_kavanaugh",     lastName: "Kavanaugh", fullName: "Brett M. Kavanaugh",    short: "BK",  seniority: 6, ideology: 4 },
  { id: "amy_coney_barrett",     lastName: "Barrett",   fullName: "Amy Coney Barrett",     short: "ACB", seniority: 7, ideology: 5 },
  { id: "ketanji_brown_jackson", lastName: "Jackson",   fullName: "Ketanji Brown Jackson", short: "KBJ", seniority: 8, ideology: 2 },
];

/** Justice ids in seniority order (lineup-key position order). */
export const SENIORITY_IDS = JUSTICES.map((j) => j.id);

/** Justice ids in ideological display order (Sotomayor → ... → Thomas). */
export const IDEOLOGICAL_IDS = [...JUSTICES]
  .sort((a, b) => a.ideology - b.ideology)
  .map((j) => j.id);

export const JUSTICE_BY_ID: Record<string, Justice> = Object.fromEntries(
  JUSTICES.map((j) => [j.id, j])
);

export const N_JUSTICES = JUSTICES.length;

/** First day every member of the current bench was seated. */
export const NATURAL_COURT_START = "2022-06-30";

import { GAME_JUSTICES, justiceLabel } from "./roster";
import type { PoolCase } from "./game-types";

export interface Category {
  id: string;
  label: string;
  group:
    | "Topic"
    | "Authorship"
    | "Margin"
    | "Disposition"
    | "Party"
    | "Era"
    | "Direction"
    | "Clerkship";
  test: (c: PoolCase) => boolean;
}

/**
 * October Terms in which a current figure was clerking at the Court. A case
 * "decided while X was clerking" means case.term is one of these. Source facts:
 *   Justices — Roberts (Rehnquist, OT1980), Kagan (Marshall, OT1987),
 *   Gorsuch & Kavanaugh (Kennedy, OT1993), Barrett (Scalia, OT1998),
 *   Jackson (Breyer, OT1999).
 *   Senators — Cruz (Rehnquist, OT1996), Lee (Alito, OT2006),
 *   Hawley (Roberts, OT2007).
 */
const JUSTICE_CLERK_TERMS = new Set([1980, 1987, 1993, 1998, 1999]);
const SENATOR_CLERK_TERMS = new Set([1996, 2006, 2007]);

// broad issueArea topics the user enabled
const ISSUE_AREAS: [number, string][] = [
  [1, "Criminal Procedure"],
  [2, "Civil Rights"],
  [3, "First Amendment"],
  [4, "Due Process"],
  [5, "Privacy"],
  [10, "Federalism"],
  [12, "Federal Taxation"],
];

// sharper topics keyed off SCDB granular `issue` codes
const ISSUE_TOPICS: { id: string; label: string; codes: number[] }[] = [
  { id: "t:search", label: "Search & seizure", codes: [10050, 10060, 10070] },
  { id: "t:patent", label: "Patents & copyright", codes: [80180, 80190, 80200, 80210] },
  { id: "t:establishment", label: "Establishment Clause", codes: [30170, 30180] },
  { id: "t:voting", label: "Voting rights", codes: [20010, 20020, 20030, 20090] },
  { id: "t:freeexercise", label: "Free exercise of religion", codes: [30160] },
  { id: "t:indian", label: "Indian law", codes: [20150, 20160] },
  { id: "t:abortion", label: "Abortion & contraception", codes: [50020] },
  { id: "t:takings", label: "Takings clause", codes: [40070] },
  { id: "t:habeas", label: "Habeas corpus", codes: [10020] },
  { id: "t:affirmative", label: "Affirmative action", codes: [20070] },
];

const REVERSED = new Set([3, 4, 5]); // reversed / reversed&remanded / vacated&remanded
const CHIEFS: [string, string][] = [
  ["Vinson", "Vinson Court"],
  ["Warren", "Warren Court"],
  ["Burger", "Burger Court"],
  ["Rehnquist", "Rehnquist Court"],
  ["Roberts", "Roberts Court"],
];

const STATIC: Category[] = [
  ...ISSUE_AREAS.map(
    ([code, label]): Category => ({
      id: `topic:${code}`,
      label,
      group: "Topic",
      test: (c) => c.issueArea === code,
    })
  ),
  ...ISSUE_TOPICS.map(({ id, label, codes }): Category => {
    const set = new Set(codes);
    return {
      id,
      label,
      group: "Topic",
      test: (c) => c.issue != null && set.has(c.issue),
    };
  }),
  {
    id: "margin:5-4",
    label: "Decided 5–4",
    group: "Margin",
    test: (c) => c.maj === 5 && c.min === 4,
  },
  {
    id: "margin:6-3",
    label: "Decided 6–3",
    group: "Margin",
    test: (c) => c.maj === 6 && c.min === 3,
  },
  {
    id: "margin:onevote",
    label: "Won by one vote",
    group: "Margin",
    test: (c) => c.min > 0 && c.maj - c.min === 1,
  },
  {
    id: "margin:3plus",
    label: "3+ dissents",
    group: "Margin",
    test: (c) => c.min >= 3,
  },
  {
    id: "disp:reversed",
    label: "Reversed the court below",
    group: "Disposition",
    test: (c) => c.disposition != null && REVERSED.has(c.disposition),
  },
  {
    id: "disp:affirmed",
    label: "Affirmed the court below",
    group: "Disposition",
    test: (c) => c.disposition === 2,
  },
  {
    id: "party:us",
    label: "U.S. was a party",
    group: "Party",
    test: (c) => c.petitioner === 27 || c.respondent === 27,
  },
  {
    id: "party:state",
    label: "A State was a party",
    group: "Party",
    test: (c) => c.petitioner === 28 || c.respondent === 28,
  },
  ...CHIEFS.map(
    ([chief, label]): Category => ({
      id: `era:${chief}`,
      label,
      group: "Era",
      test: (c) => c.chief === chief,
    })
  ),
  {
    id: "dir:liberal",
    label: "Liberal result",
    group: "Direction",
    test: (c) => c.direction === 2,
  },
  {
    id: "dir:conservative",
    label: "Conservative result",
    group: "Direction",
    test: (c) => c.direction === 1,
  },
  {
    id: "clerk:justice",
    label: "Decided while a sitting Justice clerked",
    group: "Clerkship",
    test: (c) => JUSTICE_CLERK_TERMS.has(c.term),
  },
  {
    id: "clerk:senator",
    label: "Decided while a sitting Senator clerked",
    group: "Clerkship",
    test: (c) => SENATOR_CLERK_TERMS.has(c.term),
  },
];

const AUTHORSHIP: Category[] = GAME_JUSTICES.map((j) => ({
  id: `wrote:${j.id}`,
  label: `Majority by ${justiceLabel(j.id)}`,
  group: "Authorship" as const,
  test: (c: PoolCase) => c.majWriter === j.id,
}));

export const CATEGORIES: Category[] = [...STATIC, ...AUTHORSHIP];

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
);

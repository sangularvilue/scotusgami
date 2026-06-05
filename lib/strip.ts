import { IDEOLOGICAL_IDS, JUSTICE_BY_ID } from "./justices";
import type { Side } from "./types";

/**
 * Matrix-row cell order: one column per justice, ideological left→right
 * (Sotomayor … Thomas). Each entry is the seniority index (= lineup-key
 * position) of that column.
 */
export const COL_TO_KEYPOS = IDEOLOGICAL_IDS.map(
  (id) => JUSTICE_BY_ID[id].seniority
);

/** Sides for the 9 columns (ideological order). */
export function colSides(key: string): Side[] {
  return COL_TO_KEYPOS.map((pos) => key[pos] as Side);
}

const VAR: Record<"M" | "D", string> = {
  M: "var(--c-m)",
  D: "var(--c-d)",
};

/** Default matrix cell geometry (wide rectangles per Will's spec). */
export const CELL_W = 44;
export const CELL_H = 28;
export const CELL_GAP = 2;

/**
 * Style for one side's overlay span. Majority cells are full-height blocks;
 * dissent cells are slim centered pills — separated by shape, not just hue.
 * Absent columns paint nothing (a hole in the row). One span per side: the
 * span itself sits in column 0 and casts hard box-shadows into its other
 * columns; its own background is transparent when column 0 isn't this side.
 */
export function sideStyle(
  key: string,
  side: "M" | "D",
  cellW = CELL_W,
  cellH = CELL_H,
  gap = CELL_GAP
): React.CSSProperties | null {
  const sides = colSides(key);
  const pitch = cellW + gap;
  const h = side === "M" ? cellH : Math.max(4, Math.round(cellH * 0.42));
  const shadows: string[] = [];
  for (let i = 1; i < 9; i++) {
    if (sides[i] === side) shadows.push(`${i * pitch}px 0 0 0 ${VAR[side]}`);
  }
  const own = sides[0] === side;
  if (!own && shadows.length === 0) return null;
  return {
    width: cellW,
    height: h,
    top: (cellH - h) / 2,
    background: own ? VAR[side] : "transparent",
    boxShadow: shadows.length ? shadows.join(", ") : undefined,
    borderRadius: side === "D" ? h / 2 : 3,
  };
}

/** Total strip width for a given cell/gap. */
export const stripWidth = (cellW = CELL_W, gap = CELL_GAP) =>
  9 * cellW + 8 * gap;

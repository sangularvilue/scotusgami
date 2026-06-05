import { IDEOLOGICAL_IDS, JUSTICE_BY_ID } from "./justices";
import type { Side } from "./types";

/**
 * Display order for glyph cells: ideological, row-major.
 *   Sotomayor Kagan    Jackson
 *   Roberts   Kavanaugh Barrett
 *   Gorsuch   Alito    Thomas
 * Each entry is the seniority index (= lineup-key position) of that cell.
 */
export const CELL_TO_KEYPOS = IDEOLOGICAL_IDS.map(
  (id) => JUSTICE_BY_ID[id].seniority
);

/** Sides for the 9 glyph cells (row-major ideological order). */
export function cellSides(key: string): Side[] {
  return CELL_TO_KEYPOS.map((pos) => key[pos] as Side);
}

const VAR: Record<Side, string> = {
  M: "var(--c-m)",
  D: "var(--c-d)",
  A: "var(--c-a)",
};

/**
 * Pixel-art glyph: one 6px span paints cell 0 with its background and the
 * other 8 cells with hard box-shadows (7px pitch = 6px cell + 1px gap).
 */
export function glyphStyle(key: string): React.CSSProperties {
  const sides = cellSides(key);
  const shadows: string[] = [];
  for (let i = 1; i < 9; i++) {
    const x = (i % 3) * 7;
    const y = Math.floor(i / 3) * 7;
    shadows.push(`${x}px ${y}px 0 0 ${VAR[sides[i]]}`);
  }
  return {
    left: 3,
    top: 3,
    background: VAR[sides[0]],
    boxShadow: shadows.join(", "),
  };
}

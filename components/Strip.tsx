import { CELL_GAP, CELL_H, CELL_W, sideStyle, stripWidth } from "@/lib/strip";

/**
 * One Court lineup as a horizontal strip: majority = full gold blocks,
 * dissent = slim slate pills, took-no-part = a hole.
 */
export default function Strip({
  k,
  cellW = CELL_W,
  cellH = CELL_H,
  gap = CELL_GAP,
}: {
  k: string;
  cellW?: number;
  cellH?: number;
  gap?: number;
}) {
  const m = sideStyle(k, "M", cellW, cellH, gap);
  const d = sideStyle(k, "D", cellW, cellH, gap);
  return (
    <span
      className="vwrap relative block"
      style={{ width: stripWidth(cellW, gap), height: cellH }}
    >
      {m && <span className="vstrip absolute left-0" style={m} />}
      {d && <span className="vstrip absolute left-0" style={d} />}
    </span>
  );
}

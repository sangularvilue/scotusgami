import {
  CELL_GAP,
  CELL_H,
  CELL_W,
  sideStyle,
  stripWidth,
  tieStyle,
} from "@/lib/strip";

/**
 * One Court lineup as a horizontal strip: majority = full gold blocks,
 * dissent = slim slate pills, took-no-part = a hole, equally divided =
 * half-gold / half-slate split cells.
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
  const tTop = tieStyle(k, "top", cellW, cellH, gap);
  const tBot = tieStyle(k, "bottom", cellW, cellH, gap);
  return (
    <span
      className="vwrap relative block"
      style={{ width: stripWidth(cellW, gap), height: cellH }}
    >
      {m && <span className="vstrip absolute left-0" style={m} />}
      {d && <span className="vstrip absolute left-0" style={d} />}
      {tTop && <span className="vstrip absolute left-0" style={tTop} />}
      {tBot && <span className="vstrip absolute left-0" style={tBot} />}
    </span>
  );
}

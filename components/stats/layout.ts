/**
 * Resolve overlapping label positions along the y-axis: keep each label near its
 * anchor but push neighbors apart so text doesn't stack. Greedy downward sweep,
 * then shift up if it overflows the bottom. Returns adjusted y per input index.
 */
export function spreadY(
  desired: number[],
  minGap: number,
  lo: number,
  hi: number
): number[] {
  const order = desired.map((_, i) => i).sort((a, b) => desired[a] - desired[b]);
  const out = desired.slice();
  for (let k = 1; k < order.length; k++) {
    const i = order[k];
    const prev = order[k - 1];
    if (out[i] < out[prev] + minGap) out[i] = out[prev] + minGap;
  }
  const last = order[order.length - 1];
  if (out[last] > hi) {
    const shift = out[last] - hi;
    for (const i of order) out[i] -= shift;
    for (let k = order.length - 2; k >= 0; k--) {
      const i = order[k];
      const nx = order[k + 1];
      if (out[i] > out[nx] - minGap) out[i] = out[nx] - minGap;
    }
  }
  for (const i of order) out[i] = Math.max(lo, Math.min(hi, out[i]));
  return out;
}

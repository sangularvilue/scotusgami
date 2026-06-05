import { decodeLineup, encodeLineup, enumerateSections, expectedCounts } from "../lib/grid";

const sections = enumerateSections();
const expected = expectedCounts();

let ok = true;
for (const s of sections) {
  const want = expected[s.k];
  const got = s.squareCount;
  const pass = want === got;
  ok &&= pass;
  console.log(`k=${s.k} (${s.title}): ${got} squares (expected ${want}) ${pass ? "✓" : "✗"}`);
}

// Round-trip a few keys
const allKeys = sections.flatMap((s) =>
  s.subsections.flatMap((ss) => ss.groups.flatMap((g) => g.keys))
);
const unique = new Set(allKeys);
console.log(`total enumerated: ${allKeys.length}, unique: ${unique.size} ${allKeys.length === unique.size ? "✓" : "✗ DUPES"}`);
ok &&= allKeys.length === unique.size;

for (const key of [allKeys[0], allKeys[123], allKeys[allKeys.length - 1]]) {
  const rt = encodeLineup(decodeLineup(key));
  if (rt !== key) {
    console.log(`round-trip FAIL: ${key} -> ${rt}`);
    ok = false;
  }
}
console.log(ok ? "ALL CHECKS PASSED" : "CHECKS FAILED");
process.exit(ok ? 0 : 1);

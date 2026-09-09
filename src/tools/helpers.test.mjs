// Run: node src/tools/helpers.test.mjs
import assert from "node:assert/strict";
import { mapLimit } from "../../dist/tools/helpers.js";

// order preserved, every item mapped
const items = Array.from({ length: 25 }, (_, i) => i);
const out = await mapLimit(items, 4, async (n) => n * 2);
assert.deepEqual(out, items.map((n) => n * 2), "results must stay in input order");

// concurrency never exceeds the cap
let inFlight = 0, peak = 0;
await mapLimit(items, 4, async () => {
  peak = Math.max(peak, ++inFlight);
  await new Promise((r) => setTimeout(r, 5));
  inFlight--;
});
assert.equal(peak, 4, `peak concurrency ${peak}, expected 4`);

// cap larger than the list spawns no idle workers, still correct
assert.deepEqual(await mapLimit([1, 2], 8, async (n) => n + 1), [2, 3]);
assert.deepEqual(await mapLimit([], 8, async (n) => n), []);

// a rejection propagates rather than being swallowed
await assert.rejects(
  () => mapLimit(items, 4, async (n) => { if (n === 7) throw new Error("boom"); return n; }),
  /boom/,
);
console.log("helpers.test: all assertions passed (peak concurrency", peak + ")");

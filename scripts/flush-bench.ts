/** Delete cached daily puzzles (scotusgami:bench:*) after a generator change. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Redis } from "@upstash/redis";

async function main() {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=["']?([^"']*)["']?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  let cursor = "0";
  let deleted = 0;
  do {
    const [next, keys] = await redis.scan(cursor, {
      match: "scotusgami:bench:*",
      count: 200,
    });
    cursor = next;
    if (keys.length) {
      await redis.del(...(keys as string[]));
      deleted += keys.length;
    }
  } while (cursor !== "0");
  console.log(`flushed ${deleted} cached puzzles`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

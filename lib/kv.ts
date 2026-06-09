import { Redis } from "@upstash/redis";

let client: Redis | null = null;
function kv(): Redis {
  client ??= new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return client;
}

export const kvGet = <T>(key: string) => kv().get<T>(key);
export const kvSet = (key: string, value: unknown) => kv().set(key, value);

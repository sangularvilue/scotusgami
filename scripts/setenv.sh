#!/usr/bin/env bash
# One-time: push .env.local values into Vercel production env, then redeploy.
set -e
cd "$(dirname "$0")/.."

while IFS='=' read -r name value; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  echo "setting $name"
  echo "$value" | npx vercel env add "$name" production || true
done < .env.local

npx vercel env ls production
npx vercel deploy --prod

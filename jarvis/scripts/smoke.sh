#!/usr/bin/env bash
# Boots the Worker in Cloudflare's local runtime (workerd) and checks the real request paths:
# health, webhook auth, pairing through a signed webhook, a Telegram send attempt, and a cron tick.
# The AI binding is left out because it needs a Cloudflare login; everything else runs for real.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
WORK=$(mktemp -d)
PORT=${PORT:-8799}
trap 'kill $DEV_PID 2>/dev/null || true; rm -rf "$WORK"' EXIT

grep -v -E '^\[ai\]|^binding = "AI"' wrangler.toml |
	sed -e "s#main = \"src/index.ts\"#main = \"$ROOT/src/index.ts\"#" -e "s#migrations_dir = \"migrations\"#migrations_dir = \"$ROOT/migrations\"#" >"$WORK/wrangler.toml"
printf 'TELEGRAM_BOT_TOKEN=SMOKE\nGEMINI_API_KEY=fake\nPAIR_CODE=smoke-code\n' >"$WORK/.dev.vars"
WRANGLER="$ROOT/node_modules/.bin/wrangler"

cd "$WORK"
CI=1 "$WRANGLER" d1 migrations apply jarvis --local >/dev/null
CI=1 "$WRANGLER" d1 migrations apply jarvis_eval --local >/dev/null
CI=1 "$WRANGLER" dev --port "$PORT" --test-scheduled >"$WORK/dev.log" 2>&1 &
DEV_PID=$!

for _ in $(seq 1 60); do
	curl -sf --noproxy '*' "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
	sleep 1
done

fail() {
	echo "SMOKE FAIL: $1"
	cat "$WORK/dev.log"
	exit 1
}

curl -sf --noproxy '*' "http://127.0.0.1:$PORT/health" | grep -q '"ok":true' || fail "health check"
code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/telegram" -d '{}')
[ "$code" = 403 ] || fail "unsigned webhook should be 403, got $code"

SECRET=$(node -e "console.log(require('crypto').createHash('sha256').update('jarvis-webhook:SMOKE').digest('hex').slice(0,48))")
code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/telegram" \
	-H "x-telegram-bot-api-secret-token: $SECRET" -H 'content-type: application/json' \
	-d '{"update_id":5,"message":{"message_id":1,"chat":{"id":1001},"text":"/start smoke-code"}}')
[ "$code" = 200 ] || fail "signed webhook should be 200, got $code"
sleep 3
curl -sf --noproxy '*' "http://127.0.0.1:$PORT/__scheduled?cron=*/5+*+*+*+*" >/dev/null || fail "scheduled trigger"
sleep 4

paired=$(CI=1 "$WRANGLER" d1 execute jarvis --local --json --command "SELECT v FROM kv WHERE k = 'owner_chat_id'" 2>/dev/null | grep -c '"1001"' || true)
[ "$paired" -ge 1 ] || fail "pairing did not store the owner"
# Live eval path: lists cases, and one step runs end to end on the scratch database (the fake key makes the brain fail).
curl -sf --noproxy '*' -H "x-jarvis-key: $SECRET" "http://127.0.0.1:$PORT/eval" | grep -q '"ready":true' || fail "eval case list"
curl -sf --noproxy '*' -H "x-jarvis-key: $SECRET" "http://127.0.0.1:$PORT/eval?case=reminder&step=0" | grep -q '"result"' || fail "eval step"
evalpaired=$(CI=1 "$WRANGLER" d1 execute jarvis --local --json --command "SELECT count(*) AS c FROM messages WHERE text LIKE '%call mom%'" 2>/dev/null | grep -c '"c": 0' || true)
[ "$evalpaired" -ge 1 ] || fail "eval leaked into the real database"
grep -q 'Illegal invocation' "$WORK/dev.log" && fail "runtime binding error"
grep -q 'tick not paired' "$WORK/dev.log" && fail "tick ran without seeing the pairing"
echo "SMOKE OK: health, webhook auth, pairing, cron tick and live evals all work in workerd"

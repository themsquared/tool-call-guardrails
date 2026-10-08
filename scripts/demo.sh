#!/usr/bin/env bash
# Runs the three MCP guardrail scenarios against a local agentgateway and
# prints each result. Requires an `agentgateway` binary on PATH (or set
# AGENTGATEWAY_BIN) built from a commit containing the mcpGuardrails CEL
# processor (unreleased as of 2026-10-08; see README for the build command).
set -euo pipefail
cd "$(dirname "$0")/.."

AGENTGATEWAY_BIN="${AGENTGATEWAY_BIN:-agentgateway}"
INSPECTOR="npx -y @modelcontextprotocol/inspector --cli"
MCP_URL="http://localhost:13000/mcp"
mkdir -p captures

echo "--- starting agentgateway (config.yaml) ---"
"$AGENTGATEWAY_BIN" -f config.yaml > captures/gateway.log 2>&1 &
GW_PID=$!
trap 'kill $GW_PID 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  if curl -s -o /dev/null "http://localhost:13000/mcp"; then
    break
  fi
  sleep 0.5
done

echo "--- 1. tools/list ---"
$INSPECTOR "$MCP_URL" --method tools/list | tee captures/01-tools-list.json

echo "--- 2. reject: run_support_macro with raw_command containing 'rm -rf' ---"
$INSPECTOR "$MCP_URL" --method tools/call --tool-name run_support_macro \
  --tool-arg customer_id=cust-1002 --tool-arg macro=reset_password \
  --tool-arg "raw_command=rm -rf /data/cust-1002" \
  | tee captures/02-reject.json || true

echo "--- 3. mask on request: email in the macro argument never reaches the tool ---"
$INSPECTOR "$MCP_URL" --method tools/call --tool-name run_support_macro \
  --tool-arg customer_id=cust-1002 \
  --tool-arg "macro=escalate to priya.shah@example.com" \
  | tee captures/03-request-mask.json

echo "--- 4. mask on response: the API key in lookup_customer's notes is redacted ---"
$INSPECTOR "$MCP_URL" --method tools/call --tool-name lookup_customer \
  --tool-arg customer_id=cust-1001 \
  | tee captures/04-response-mask.json

echo "--- gateway log ---"
cat captures/gateway.log

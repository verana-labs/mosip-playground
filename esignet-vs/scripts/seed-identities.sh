#!/usr/bin/env bash
# (Re)seed the mock identities from ../identities/*.json into the running
# mock-identity-system pod. The ephemeral eSignet postgres drops these (Asha/Ravi)
# on any restart and login then fails with "invalid individual id". Unlike the OIDC
# clients there's no public endpoint, so recovery goes through kubectl exec.
set -euo pipefail

NS="${1:-${K8S_NAMESPACE:-mosip}}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../identities" && pwd)"

POD=$(kubectl get pods -n "$NS" -l app=mock-identity-system -o jsonpath='{.items[0].metadata.name}')
[ -n "$POD" ] || { echo "mock-identity-system pod not found in namespace $NS" >&2; exit 1; }

ok=1
for f in "$DIR"/*.json; do
  id=$(jq -r '.individualId' "$f")
  now=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  body=$(jq -n --arg t "$now" --slurpfile r "$f" '{requestTime:$t, request:$r[0]}')
  resp=$(printf '%s' "$body" | kubectl exec -i "$POD" -n "$NS" -- \
    curl -s -X POST http://localhost:8082/v1/mock-identity-system/identity \
    -H 'Content-Type: application/json' -d @-)
  if printf '%s' "$resp" | jq -e '(.errors // []) | length == 0' >/dev/null 2>&1; then
    echo "ok   $id"
  else
    echo "FAIL $id -> $resp"
    ok=0
  fi
done

[ "$ok" = 1 ] || { echo "one or more identities failed to seed"; exit 1; }
echo "all identities seeded"

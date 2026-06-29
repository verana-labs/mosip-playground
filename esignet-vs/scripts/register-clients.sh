#!/usr/bin/env bash
# Re-register every eSignet OIDC client from esignet-vs/clients/*.json.
#
# eSignet's client store is an ephemeral postgres (emptyDir, no PVC — see
# esignet-vs/manifest.yaml), so any postgres-esignet restart wipes all registered
# clients and oauth-details then returns invalid_client_id for everything. The
# deploy workflow seeds on deploy; run this to recover between deploys.
#
# client-mgmt is csrf-exempt and open under the bundled local profile. Idempotent:
# POST creates a missing client, PUT updates one that already exists.
set -euo pipefail

BASE="${ESIGNET_BASE:-https://esignet-vs.mosip.testnet.verana.network/v1/esignet}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../clients" && pwd)"

ok=1
for f in "$DIR"/*.json; do
  cid=$(jq -r '.clientId' "$f")
  now=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

  body=$(jq -n --arg t "$now" --slurpfile r "$f" '{requestTime:$t, request:$r[0]}')
  resp=$(curl -s -X POST "$BASE/client-mgmt/oidc-client" -H 'Content-Type: application/json' -d "$body")

  if ! echo "$resp" | jq -e '(.errors // []) | length == 0' >/dev/null 2>&1; then
    # Create rejected (usually duplicate_client) -> update the existing client in place.
    put=$(jq -n --arg t "$now" --slurpfile c "$f" '{
      requestTime: $t,
      request: {
        clientName:        $c[0].clientName,
        logoUri:           $c[0].logoUri,
        redirectUris:      $c[0].redirectUris,
        userClaims:        $c[0].userClaims,
        authContextRefs:   $c[0].authContextRefs,
        status:            "ACTIVE",
        grantTypes:        $c[0].grantTypes,
        clientAuthMethods: $c[0].clientAuthMethods
      }}')
    resp=$(curl -s -X PUT "$BASE/client-mgmt/oidc-client/$cid" -H 'Content-Type: application/json' -d "$put")
  fi

  if echo "$resp" | jq -e '(.errors // []) | length == 0' >/dev/null 2>&1; then
    echo "ok   $cid"
  else
    echo "FAIL $cid -> $resp"
    ok=0
  fi
done

[ "$ok" = 1 ] || { echo "one or more clients failed to register"; exit 1; }
echo "all clients registered"

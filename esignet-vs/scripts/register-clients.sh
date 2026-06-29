#!/usr/bin/env bash
# (Re)register every client in ../clients/*.json. eSignet's client store is ephemeral
# (emptyDir), so a postgres restart drops them and oauth-details starts returning
# invalid_client_id; rerun to restore. POST creates, PUT updates if it already exists.
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

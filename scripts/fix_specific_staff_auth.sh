#!/usr/bin/env bash
set -euo pipefail

# Script to fix specific staff Auth users via Supabase Admin API.
# Usage:
#   1) Make this file executable: chmod +x scripts/fix_specific_staff_auth.sh
#   2) Run: ./scripts/fix_specific_staff_auth.sh
# The script will ask for your SERVICE_ROLE_KEY (never hardcode in repo).

read -rp "Supabase project URL (default: https://zaemlxjwhzrfmowbckmk.supabase.co): " SUPABASE_URL_INPUT
SUPABASE_URL=${SUPABASE_URL_INPUT:-https://zaemlxjwhzrfmowbckmk.supabase.co}
read -rsp "Paste your SERVICE_ROLE_KEY (will not be shown): " SERVICE_ROLE_KEY
echo

CONTENT_TYPE_HEADER="Content-Type: application/json"
APIKEY_HEADER="apikey: ${SERVICE_ROLE_KEY}"
AUTH_HEADER="Authorization: Bearer ${SERVICE_ROLE_KEY}"

echo "Using Supabase URL: ${SUPABASE_URL}"

# List of users to fix (auth_user_id, email, password)
USERS=(
  "8b64065a-cbad-4fdb-9b24-3b4aeb6e343a|agentesian8nautomacao@gmail.com|dev123"
  "9ab3ffa6-5762-4700-9d19-758ad2f115a6|paulohmorais@hotmail.com|admin123"
  "1368510e-329a-4ded-87ea-d606b24d2676|email.real@dominio.com|123456"
)

echo "Processing ${#USERS[@]} users..."

for entry in "${USERS[@]}"; do
  IFS='|' read -r AUTH_ID EMAIL PASSWORD <<< "$entry"
  echo
  echo "-> Updating auth user: ${AUTH_ID}"
  echo "   email: ${EMAIL}"
  # Build payload JSON
  payload=$(jq -n --arg email "$EMAIL" --arg password "$PASSWORD" '{email: $email, password: $password, email_confirm: true}')

  resp=$(curl -s -w "\n%{http_code}" -X PUT "${SUPABASE_URL%/}/auth/v1/admin/users/${AUTH_ID}" \
    -H "$APIKEY_HEADER" -H "$AUTH_HEADER" -H "$CONTENT_TYPE_HEADER" \
    -d "$payload")

  http_code=$(echo "$resp" | tail -n1)
  body=$(echo "$resp" | sed '$d')

  echo "   HTTP status: $http_code"
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo "   Success. Response:"
    echo "$body"
    echo "   User ${EMAIL} should now be able to log in with the provided password."
  else
    echo "   ERROR. Response body:"
    echo "$body"
    echo "   Please check the SERVICE_ROLE_KEY permissions and network, then retry."
  fi
done

echo
echo "Done. Verify by attempting login (email + password) or checking Auth → Users in Supabase Dashboard."

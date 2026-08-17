#!/usr/bin/env bash
set -u
SUPABASE_URL="https://crnppzaihmvhvztcpeap.supabase.co"
ANON_KEY="$(sed -n 's/^const SUPABASE_ANON_KEY = "\(.*\)";$/\1/p' src/supabaseClient.js)"
pass=0
fail=0
check_rpc() {
  local name="$1"; local body="$2"
  local response code
  response=$(curl -sS -w '\n%{http_code}' -X POST "$SUPABASE_URL/rest/v1/rpc/$name" \
    -H "apikey: $ANON_KEY" -H 'Authorization: Bearer '"$ANON_KEY" \
    -H 'Content-Type: application/json' --data "$body")
  code=$(printf '%s\n' "$response" | tail -1)
  if [ "$code" = "401" ] || [ "$code" = "403" ]; then pass=$((pass+1)); else fail=$((fail+1)); fi
  printf '%s\tHTTP_%s\t%s\n' "$name" "$code" "$(printf '%s\n' "$response" | head -c 240)"
}
check_rpc zaro_apply_inventory_movement '{"p_code":"NO-SUCH-CODE","p_type":"خصم","p_qty":1,"p_reason":"qa","p_date":"2026-08-16"}'
check_rpc zaro_update_section '{"p_section":"orders","p_payload":[]}'
check_rpc zaro_set_user_role '{"p_user_id":"00000000-0000-0000-0000-000000000000","p_role":"viewer"}'
printf 'passed=%s failed=%s\n' "$pass" "$fail"
[ "$fail" -eq 0 ]

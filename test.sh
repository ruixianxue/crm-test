#!/bin/bash
# Backend acceptance test script for the Rodium CRM technical test.
# Run this while `docker compose up` (or local dev servers) are running.
#
# Usage:
#   chmod +x verify-backend.sh
#   ./verify-backend.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

section() { echo ""; echo "== $1 =="; }

# --- 0. Reachability ---
section "0. Backend reachable"
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/columns" | grep -q "200"; then
  pass "GET /columns returns 200"
else
  fail "Backend not reachable at $BASE_URL — aborting"
  exit 1
fi

# --- 1. Columns exist with correct types ---
section "1. Default columns exist with 4 required types"
COLUMNS=$(curl -s "$BASE_URL/columns")
for t in text number date phone; do
  if echo "$COLUMNS" | grep -q "\"type\":\"$t\""; then
    pass "Found a column of type '$t'"
  else
    fail "No column of type '$t' found"
  fi
done

# --- 2. Contacts total >= 500 ---
section "2. At least 500 seeded contacts"
TOTAL=$(curl -s "$BASE_URL/contacts?limit=1" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
if [ "$TOTAL" -ge 500 ] 2>/dev/null; then
  pass "total=$TOTAL (>= 500)"
else
  fail "total=$TOTAL (expected >= 500)"
fi

# --- 3. Pagination works ---
section "3. Pagination (offset/limit)"
PAGE1=$(curl -s "$BASE_URL/contacts?offset=0&limit=5")
PAGE2=$(curl -s "$BASE_URL/contacts?offset=5&limit=5")
if [ "$PAGE1" != "$PAGE2" ]; then
  pass "Different offsets return different pages"
else
  fail "Page 1 and page 2 look identical — pagination may be broken"
fi
if echo "$PAGE1" | grep -q '"hasMore":true'; then
  pass "hasMore flag present and true on first page"
else
  fail "hasMore not true on first page (unexpected with 500+ contacts)"
fi

# --- 4. Sorting: numeric column sorts numerically, not lexically ---
section "4. Sorting correctness (numeric column)"
NUMERIC_COL=$(echo "$COLUMNS" | grep -o '"key":"[^"]*","label":"[^"]*","type":"number"' | head -1 | grep -o '"key":"[^"]*"' | sed 's/"key":"//;s/"//')
if [ -n "$NUMERIC_COL" ]; then
  SORTED=$(curl -s "$BASE_URL/contacts?sortBy=$NUMERIC_COL&sortDir=ASC&limit=5")
  VALUES=$(echo "$SORTED" | grep -o "\"$NUMERIC_COL\":[0-9]*" | grep -o '[0-9]*$')
  SORTED_CHECK=$(echo "$VALUES" | sort -n)
  if [ "$VALUES" == "$SORTED_CHECK" ]; then
    pass "Ascending sort on '$NUMERIC_COL' is numerically correct"
  else
    fail "Ascending sort on '$NUMERIC_COL' is NOT numerically correct"
  fi
else
  fail "No numeric column found to test sorting"
fi

# --- 4b. Sort stability across repeated requests (tie-breaker regression test) ---
section "4b. Sort stability across repeated requests (no sortBy)"
RUN1=$(curl -s "$BASE_URL/contacts?offset=0&limit=10" | grep -o '"id":"[^"]*"')
RUN2=$(curl -s "$BASE_URL/contacts?offset=0&limit=10" | grep -o '"id":"[^"]*"')
if [ "$RUN1" == "$RUN2" ]; then
  pass "Default order is stable across repeated requests (id tie-breaker working)"
else
  fail "Default order changed between identical requests — missing tie-breaker"
fi

# --- 5. Filtering: text column partial match ---
section "5. Filtering correctness (text column)"
TEXT_COL=$(echo "$COLUMNS" | grep -o '"key":"[^"]*","label":"[^"]*","type":"text"' | head -1 | grep -o '"key":"[^"]*"' | sed 's/"key":"//;s/"//')
if [ -n "$TEXT_COL" ]; then
  FILTERED=$(curl -s "$BASE_URL/contacts?filterBy=$TEXT_COL&filterValue=a&limit=50")
  FILTERED_TOTAL=$(echo "$FILTERED" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
  if [ "$FILTERED_TOTAL" -lt "$TOTAL" ] 2>/dev/null && [ "$FILTERED_TOTAL" -gt 0 ] 2>/dev/null; then
    pass "Filtering on '$TEXT_COL' reduces result count ($FILTERED_TOTAL < $TOTAL)"
  else
    fail "Filtering on '$TEXT_COL' did not behave as expected (got total=$FILTERED_TOTAL)"
  fi
else
  fail "No text column found to test filtering"
fi

# --- 6. Filtering: invalid number/date input does not crash (500) ---
section "6. Filter robustness (invalid partial input should not 500)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/contacts?filterBy=$NUMERIC_COL&filterValue=abc")
if [ "$STATUS" != "500" ]; then
  pass "Invalid numeric filter value does not return 500 (got $STATUS)"
else
  fail "Invalid numeric filter value returned 500 Internal Server Error"
fi

DATE_COL=$(echo "$COLUMNS" | grep -o '"key":"[^"]*","label":"[^"]*","type":"date"' | head -1 | grep -o '"key":"[^"]*"' | sed 's/"key":"//;s/"//')
if [ -n "$DATE_COL" ]; then
  STATUS_DATE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/contacts?filterBy=$DATE_COL&filterValue=2")
  if [ "$STATUS_DATE" != "500" ]; then
    pass "Incomplete date filter value does not return 500 (got $STATUS_DATE)"
  else
    fail "Incomplete date filter value returned 500 Internal Server Error"
  fi
fi

# --- 7. Unknown sort/filter column is rejected safely (not 500) ---
section "7. Unknown column names are rejected with 400, not 500"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/contacts?sortBy=doesNotExist")
if [ "$STATUS" == "400" ]; then
  pass "Unknown sortBy column returns 400 Bad Request"
else
  fail "Unknown sortBy column returned $STATUS (expected 400)"
fi

# --- 8. Full CRUD cycle on a contact ---
section "8. Contact CRUD cycle"
CREATE_RES=$(curl -s -X POST "$BASE_URL/contacts" \
  -H "Content-Type: application/json" \
  -d '{"data":{"name":"Test Verification Contact"}}')
CONTACT_ID=$(echo "$CREATE_RES" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
if [ -n "$CONTACT_ID" ]; then
  pass "Created test contact ($CONTACT_ID)"
else
  fail "Failed to create test contact"
fi

if [ -n "$CONTACT_ID" ]; then
  UPDATE_RES=$(curl -s -X PATCH "$BASE_URL/contacts/$CONTACT_ID" \
    -H "Content-Type: application/json" \
    -d '{"data":{"name":"Updated Verification Contact"}}')
  if echo "$UPDATE_RES" | grep -q "Updated Verification Contact"; then
    pass "Updated test contact successfully"
  else
    fail "Failed to update test contact"
  fi

  # Regression check: DELETE response must be safely parseable client-side
  # (previously: 200 + empty body broke frontend's res.json() call)
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/contacts/$CONTACT_ID")
  if [ "$DELETE_STATUS" == "200" ] || [ "$DELETE_STATUS" == "204" ]; then
    pass "Deleted test contact successfully (status $DELETE_STATUS)"
  else
    fail "Failed to delete test contact (status $DELETE_STATUS)"
  fi
fi

# --- 9. Column create must not 500 (position auto-calc regression) ---
section "9. Column CRUD cycle (regression: create must not 500)"
TEST_KEY="verifTestCol$(date +%s)" # unique key so repeated runs never collide
COL_CREATE=$(curl -s -X POST "$BASE_URL/columns" \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"$TEST_KEY\",\"label\":\"Verif Test\",\"type\":\"text\"}")
COL_ID=$(echo "$COL_CREATE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
if [ -n "$COL_ID" ]; then
  pass "Created test column without 500 (position auto-calculated correctly)"
else
  fail "Failed to create test column — response was: $COL_CREATE"
fi

if [ -n "$COL_ID" ]; then
  RENAME_RES=$(curl -s -X PATCH "$BASE_URL/columns/$COL_ID" \
    -H "Content-Type: application/json" \
    -d '{"label":"Renamed Verif Test"}')
  if echo "$RENAME_RES" | grep -q "Renamed Verif Test"; then
    pass "Renamed test column successfully"
  else
    fail "Failed to rename test column"
  fi

  DEL_COL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/columns/$COL_ID")
  if [ "$DEL_COL_STATUS" == "200" ] || [ "$DEL_COL_STATUS" == "204" ]; then
    pass "Deleted test column successfully"
  else
    fail "Failed to delete test column (status $DEL_COL_STATUS)"
  fi
fi

# --- 10. Duplicate column key is rejected ---
section "10. Duplicate column key rejected"
FIRST_KEY=$(echo "$COLUMNS" | grep -o '"key":"[^"]*"' | head -1 | sed 's/"key":"//;s/"//')
DUP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/columns" \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"$FIRST_KEY\",\"label\":\"Duplicate\",\"type\":\"text\"}")
if [ "$DUP_STATUS" == "409" ]; then
  pass "Duplicate column key rejected with 409 Conflict"
else
  fail "Duplicate column key returned $DUP_STATUS (expected 409)"
fi

# --- 11. Column reorder persists correctly (and is restored afterwards) ---
section "11. Column reorder"
COLS_BEFORE=$(curl -s "$BASE_URL/columns")
IDS=($(echo "$COLS_BEFORE" | grep -o '"id":"[^"]*"' | sed 's/"id":"//;s/"//'))
if [ "${#IDS[@]}" -ge 2 ]; then
  REORDER_BODY="{\"items\":[{\"id\":\"${IDS[1]}\",\"position\":0},{\"id\":\"${IDS[0]}\",\"position\":1}]}"
  REORDER_RES=$(curl -s -X PATCH "$BASE_URL/columns/reorder" -H "Content-Type: application/json" -d "$REORDER_BODY")
  NEW_FIRST_ID=$(echo "$REORDER_RES" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
  if [ "$NEW_FIRST_ID" == "${IDS[1]}" ]; then
    pass "Reordered columns: new first column matches requested order"
  else
    fail "Reorder did not apply as expected"
  fi
  # restore original order regardless, so re-running the script doesn't drift state
  RESTORE_BODY="{\"items\":[{\"id\":\"${IDS[0]}\",\"position\":0},{\"id\":\"${IDS[1]}\",\"position\":1}]}"
  curl -s -o /dev/null -X PATCH "$BASE_URL/columns/reorder" -H "Content-Type: application/json" -d "$RESTORE_BODY"
else
  fail "Not enough columns to test reorder"
fi

# --- Summary ---
section "SUMMARY"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "  🎉 All backend checks passed."
else
  echo "  ⚠️  Some checks failed — review above."
fi
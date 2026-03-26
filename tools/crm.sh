#!/bin/bash
# CRM Tool — Direct PostgreSQL (Command Central compose service crm-db)
# Requires: repo root with web/.env.local and docker-compose.yml (e.g. /opt/agent-tim on the droplet).

SCHEMA="workspace_9rc10n79wgdr0r3z6mzti24f6"
CC_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CC_ROOT

crm_psql() {
  docker compose --env-file "$CC_ROOT/web/.env.local" -f "$CC_ROOT/docker-compose.yml" exec -T crm-db \
    psql -U postgres -d default "$@"
}

# Run a read query, return raw output
run_sql() {
  crm_psql -t -A -q -c "SET search_path TO \"$SCHEMA\"; $1"
}

# Run a query and return JSON via json_agg
run_sql_json() {
  crm_psql -t -A -q -c "SET search_path TO \"$SCHEMA\"; SELECT COALESCE(json_agg(t)::text, '[]') FROM ($1) t;"
}

# Run a query and return single JSON object
run_sql_json_obj() {
  crm_psql -t -A -q -c "SET search_path TO \"$SCHEMA\"; SELECT COALESCE(row_to_json(t)::text, 'null') FROM ($1) t;"
}

# Safe SQL string escaping via Python
sql_escape() {
  python3 -c "import sys; s=sys.stdin.read(); print(s.replace(\"'\", \"''\"))" <<< "$1"
}

case "$1" in

  # ── CONTACTS ─────────────────────────────────────────────────────────────

  list-contacts)
    run_sql_json "
      SELECT id, \"nameFirstName\" AS \"firstName\", \"nameLastName\" AS \"lastName\",
        \"emailsPrimaryEmail\" AS email, \"jobTitle\", stage::text, city
      FROM person WHERE \"deletedAt\" IS NULL
      ORDER BY \"updatedAt\" DESC LIMIT 50"
    ;;

  search-contacts)
    if [ -z "$2" ]; then echo "Usage: search-contacts <query>"; exit 1; fi
    Q=$(sql_escape "$2")
    # Return in Twenty-compatible format for Slack gateway
    RESULTS=$(crm_psql -t -A -q -c "SET search_path TO \"$SCHEMA\";
      SELECT COALESCE(json_agg(json_build_object(
        'id', id,
        'name', json_build_object('firstName', \"nameFirstName\", 'lastName', \"nameLastName\"),
        'linkedinLink', json_build_object('primaryLinkUrl', \"linkedinLinkPrimaryLinkUrl\"),
        'emails', json_build_object('primaryEmail', \"emailsPrimaryEmail\"),
        'jobTitle', \"jobTitle\",
        'stage', stage::text,
        'companyId', \"companyId\"
      ))::text, '[]')
      FROM person
      WHERE \"deletedAt\" IS NULL
        AND (\"nameFirstName\" ILIKE '%${Q}%' OR \"nameLastName\" ILIKE '%${Q}%'
             OR \"emailsPrimaryEmail\" ILIKE '%${Q}%'
             OR \"linkedinLinkPrimaryLinkUrl\" ILIKE '%${Q}%')
      LIMIT 20;")
    # Wrap in data.people format for backward compat with Slack TS parsers
    echo "{\"data\":{\"people\":${RESULTS}}}"
    ;;

  get-contact)
    if [ -z "$2" ]; then echo "Usage: get-contact <id>"; exit 1; fi
    RESULT=$(crm_psql -t -A -q -c "SET search_path TO \"$SCHEMA\";
      SELECT row_to_json(t)::text FROM (
        SELECT p.id, p.\"nameFirstName\" AS \"firstName\", p.\"nameLastName\" AS \"lastName\",
          p.\"emailsPrimaryEmail\" AS email, p.\"linkedinLinkPrimaryLinkUrl\" AS \"linkedinUrl\",
          p.\"jobTitle\", p.stage::text AS stage, p.city,
          p.\"companyId\", p.\"activeCampaignId\",
          c.name AS \"companyName\"
        FROM person p
        LEFT JOIN company c ON c.id = p.\"companyId\" AND c.\"deletedAt\" IS NULL
        WHERE p.id = '$2' AND p.\"deletedAt\" IS NULL
      ) t;")
    echo "$RESULT"
    ;;

  create-contact)
    if [ -z "$2" ]; then echo "Usage: create-contact <json>"; exit 1; fi
    # Parse JSON payload with Python, generate INSERT, execute
    RESULT=$(python3 -c "
import json, subprocess, sys, os
data = json.loads(sys.argv[1])
root = os.environ['CC_ROOT']
fn = data.get('firstName','').replace(\"'\",\"''\")
ln = data.get('lastName','').replace(\"'\",\"''\")
email = data.get('email','').replace(\"'\",\"''\")
linkedin = data.get('linkedinUrl','').replace(\"'\",\"''\")
title = data.get('jobTitle','').replace(\"'\",\"''\")
stage = data.get('stage','TARGET')
sql = f\"\"\"SET search_path TO \\\"$SCHEMA\\\";
INSERT INTO person (id, \\\"nameFirstName\\\", \\\"nameLastName\\\", \\\"emailsPrimaryEmail\\\",
  \\\"linkedinLinkPrimaryLinkUrl\\\", \\\"jobTitle\\\", stage, \\\"createdAt\\\", \\\"updatedAt\\\")
VALUES (gen_random_uuid(), '{fn}', '{ln}', NULLIF('{email}',''), NULLIF('{linkedin}',''),
  NULLIF('{title}',''), '{stage}', NOW(), NOW())
RETURNING id;\"\"\"
result = subprocess.run(
  ['docker','compose','--env-file',f'{root}/web/.env.local','-f',f'{root}/docker-compose.yml','exec','-T','crm-db','psql','-U','postgres','-d','default','-t','-A','-q','-c',sql],
  capture_output=True, text=True
)
uid = result.stdout.strip()
if uid:
  print(json.dumps({'id': uid}))
else:
  print(result.stderr, file=sys.stderr)
  sys.exit(1)
" "$2")
    echo "$RESULT"
    ;;

  update-contact)
    if [ -z "$2" ] || [ -z "$3" ]; then echo "Usage: update-contact <id> <json>"; exit 1; fi
    python3 -c "
import json, subprocess, sys, os
cid = sys.argv[1]
data = json.loads(sys.argv[2])
root = os.environ['CC_ROOT']
sets = []
field_map = {
  'firstName': '\"nameFirstName\"', 'lastName': '\"nameLastName\"',
  'email': '\"emailsPrimaryEmail\"', 'linkedinUrl': '\"linkedinLinkPrimaryLinkUrl\"',
  'jobTitle': '\"jobTitle\"', 'stage': 'stage', 'city': 'city',
  'companyId': '\"companyId\"', 'activeCampaignId': '\"activeCampaignId\"'
}
for k, v in data.items():
  col = field_map.get(k)
  if col:
    val = str(v).replace(\"'\", \"''\") if v is not None else None
    if val is None:
      sets.append(f'{col} = NULL')
    elif col == 'stage':
      sets.append(f\"{col} = '{val}'\")
    else:
      sets.append(f\"{col} = '{val}'\")
if not sets:
  print('No valid fields to update', file=sys.stderr)
  sys.exit(1)
set_clause = ', '.join(sets)
sql = f'SET search_path TO \"$SCHEMA\"; UPDATE person SET {set_clause}, \"updatedAt\" = NOW() WHERE id = \\'{cid}\\''
result = subprocess.run(
  ['docker','compose','--env-file',f'{root}/web/.env.local','-f',f'{root}/docker-compose.yml','exec','-T','crm-db','psql','-U','postgres','-d','default','-t','-A','-q','-c', sql],
  capture_output=True, text=True
)
if result.returncode == 0:
  print(json.dumps({'success': True, 'id': cid}))
else:
  print(result.stderr, file=sys.stderr)
  sys.exit(1)
" "$2" "$3"
    ;;

  delete-contact)
    if [ -z "$2" ]; then echo "Usage: delete-contact <id>"; exit 1; fi
    run_sql "UPDATE person SET \"deletedAt\" = NOW() WHERE id = '$2'"
    echo "{\"success\": true}"
    ;;

  # ── NOTES ────────────────────────────────────────────────────────────────

  write-note)
    if [ -z "$2" ] || [ -z "$3" ]; then echo "Usage: write-note <title> <content> [target_type] [target_id]"; exit 1; fi
    TARGET_TYPE="${4:-person}"
    TARGET_ID="$5"
    python3 -c "
import json, subprocess, sys, os
root = os.environ['CC_ROOT']
title = sys.argv[1].replace(\"'\", \"''\")
body = sys.argv[2].replace(\"'\", \"''\")
ttype = sys.argv[3]
tid = sys.argv[4] if len(sys.argv) > 4 else ''

# Map target type to column name
col_map = {
  'person': '\"targetPersonId\"', 'company': '\"targetCompanyId\"',
  'opportunity': '\"targetOpportunityId\"', 'campaign': '\"targetCampaignId\"'
}
target_col = col_map.get(ttype, '\"targetPersonId\"')

if tid:
  sql = f\"\"\"SET search_path TO \\\"$SCHEMA\\\";
  WITH new_note AS (
    INSERT INTO note (id, title, \\\"bodyV2Markdown\\\", \\\"createdAt\\\", \\\"updatedAt\\\")
    VALUES (gen_random_uuid(), '{title}', '{body}', NOW(), NOW())
    RETURNING id
  )
  INSERT INTO \\\"noteTarget\\\" (id, \\\"noteId\\\", {target_col}, \\\"createdAt\\\", \\\"updatedAt\\\")
  SELECT gen_random_uuid(), id, '{tid}', NOW(), NOW() FROM new_note
  RETURNING \\\"noteId\\\";\"\"\"
else:
  sql = f\"\"\"SET search_path TO \\\"$SCHEMA\\\";
  INSERT INTO note (id, title, \\\"bodyV2Markdown\\\", \\\"createdAt\\\", \\\"updatedAt\\\")
  VALUES (gen_random_uuid(), '{title}', '{body}', NOW(), NOW())
  RETURNING id;\"\"\"

result = subprocess.run(
  ['docker','compose','--env-file',f'{root}/web/.env.local','-f',f'{root}/docker-compose.yml','exec','-T','crm-db','psql','-U','postgres','-d','default','-t','-A','-q','-c', sql],
  capture_output=True, text=True
)
uid = result.stdout.strip()
if uid:
  print(json.dumps({'success': True, 'noteId': uid}))
else:
  print(result.stderr, file=sys.stderr)
  sys.exit(1)
" "$2" "$3" "$TARGET_TYPE" "$TARGET_ID"
    ;;

  # ── COMPANIES ────────────────────────────────────────────────────────────

  list-companies)
    run_sql_json "
      SELECT id, name, \"domainNamePrimaryLinkUrl\" AS domain,
        \"linkedinLinkPrimaryLinkUrl\" AS \"linkedinUrl\", employees
      FROM company WHERE \"deletedAt\" IS NULL ORDER BY name LIMIT 50"
    ;;

  search-companies)
    if [ -z "$2" ]; then echo "Usage: search-companies <query>"; exit 1; fi
    Q=$(sql_escape "$2")
    run_sql_json "
      SELECT id, name, \"domainNamePrimaryLinkUrl\" AS domain,
        \"linkedinLinkPrimaryLinkUrl\" AS \"linkedinUrl\"
      FROM company WHERE \"deletedAt\" IS NULL AND name ILIKE '%${Q}%'
      LIMIT 20"
    ;;

  get-company)
    if [ -z "$2" ]; then echo "Usage: get-company <id>"; exit 1; fi
    run_sql_json_obj "
      SELECT id, name, \"domainNamePrimaryLinkUrl\" AS domain,
        \"linkedinLinkPrimaryLinkUrl\" AS \"linkedinUrl\", employees,
        \"idealCustomerProfile\" AS icp
      FROM company WHERE id = '$2' AND \"deletedAt\" IS NULL"
    ;;

  create-company)
    if [ -z "$2" ]; then echo "Usage: create-company <json>"; exit 1; fi
    RESULT=$(python3 -c "
import json, subprocess, sys, os
root = os.environ['CC_ROOT']
data = json.loads(sys.argv[1])
name = data.get('name','').replace(\"'\",\"''\")
domain = data.get('domain','').replace(\"'\",\"''\")
sql = f\"\"\"SET search_path TO \\\"$SCHEMA\\\";
INSERT INTO company (id, name, \\\"domainNamePrimaryLinkUrl\\\", \\\"createdAt\\\", \\\"updatedAt\\\")
VALUES (gen_random_uuid(), '{name}', NULLIF('{domain}',''), NOW(), NOW())
RETURNING id;\"\"\"
result = subprocess.run(
  ['docker','compose','--env-file',f'{root}/web/.env.local','-f',f'{root}/docker-compose.yml','exec','-T','crm-db','psql','-U','postgres','-d','default','-t','-A','-q','-c', sql],
  capture_output=True, text=True
)
uid = result.stdout.strip()
if uid:
  print(json.dumps({'id': uid}))
else:
  print(result.stderr, file=sys.stderr)
  sys.exit(1)
" "$2")
    echo "$RESULT"
    ;;

  # ── CAMPAIGNS ────────────────────────────────────────────────────────────

  list-campaigns)
    run_sql_json "
      SELECT id, name, stage::text, LEFT(spec, 100) AS spec_preview
      FROM \"_campaign\" WHERE \"deletedAt\" IS NULL ORDER BY name"
    ;;

  get-campaign)
    if [ -z "$2" ]; then echo "Usage: get-campaign <campaign_id>"; exit 1; fi
    run_sql_json_obj "
      SELECT id, name, stage::text, spec
      FROM \"_campaign\" WHERE id = '$2' AND \"deletedAt\" IS NULL"
    ;;

  get-campaign-spec)
    if [ -z "$2" ]; then echo "Usage: get-campaign-spec <campaign_id>"; exit 1; fi
    run_sql "SELECT spec FROM \"_campaign\" WHERE id = '$2' AND \"deletedAt\" IS NULL"
    ;;

  update-campaign-spec)
    if [ -z "$2" ] || [ -z "$3" ]; then echo "Usage: update-campaign-spec <campaign_id> <new_spec_content>"; exit 1; fi
    SPEC=$(sql_escape "$3")
    run_sql "UPDATE \"_campaign\" SET spec = '${SPEC}', \"updatedAt\" = NOW() WHERE id = '$2'"
    echo "{\"success\": true}"
    ;;

  create-campaign)
    if [ -z "$2" ]; then echo "Usage: create-campaign <name> [spec]"; exit 1; fi
    NAME=$(sql_escape "$2")
    SPEC=$(sql_escape "${3:-}")
    RESULT=$(run_sql "INSERT INTO \"_campaign\" (id, name, spec, stage, \"createdAt\", \"updatedAt\")
      VALUES (gen_random_uuid(), '${NAME}', NULLIF('${SPEC}',''), 'PLANNING', NOW(), NOW())
      RETURNING id")
    echo "{\"id\": \"${RESULT}\"}"
    ;;

  add-to-campaign)
    if [ -z "$2" ] || [ -z "$3" ]; then echo "Usage: add-to-campaign <person_id> <campaign_id>"; exit 1; fi
    run_sql "UPDATE person SET \"activeCampaignId\" = '$3', \"updatedAt\" = NOW() WHERE id = '$2'"
    echo "{\"success\": true}"
    ;;

  remove-from-campaign)
    if [ -z "$2" ]; then echo "Usage: remove-from-campaign <person_id>"; exit 1; fi
    run_sql "UPDATE person SET \"activeCampaignId\" = NULL, \"updatedAt\" = NOW() WHERE id = '$2'"
    echo "{\"success\": true}"
    ;;

  get-campaign-context)
    if [ -z "$2" ]; then echo "Usage: get-campaign-context <person_id>"; exit 1; fi
    run_sql_json_obj "
      SELECT c.id AS \"campaignId\", c.name AS \"campaignName\", c.spec, c.stage::text
      FROM person p
      JOIN \"_campaign\" c ON c.id = p.\"activeCampaignId\" AND c.\"deletedAt\" IS NULL
      WHERE p.id = '$2' AND p.\"deletedAt\" IS NULL"
    ;;

  list-campaign-members)
    if [ -z "$2" ]; then echo "Usage: list-campaign-members <campaign_id>"; exit 1; fi
    run_sql_json "
      SELECT id, \"nameFirstName\" AS \"firstName\", \"nameLastName\" AS \"lastName\",
        stage::text, \"jobTitle\"
      FROM person WHERE \"activeCampaignId\" = '$2' AND \"deletedAt\" IS NULL
      ORDER BY \"nameFirstName\""
    ;;

  # ── HELP ─────────────────────────────────────────────────────────────────

  help|--help|-h|"")
    echo "CRM Tool (Direct PostgreSQL)"
    echo ""
    echo "CONTACTS:"
    echo "  list-contacts"
    echo "  search-contacts <query>"
    echo "  get-contact <id>"
    echo "  create-contact <json>"
    echo "  update-contact <id> <json>"
    echo "  delete-contact <id>"
    echo ""
    echo "NOTES:"
    echo "  write-note <title> <content> [target_type] [target_id]"
    echo ""
    echo "COMPANIES:"
    echo "  list-companies"
    echo "  search-companies <query>"
    echo "  get-company <id>"
    echo "  create-company <json>"
    echo ""
    echo "CAMPAIGNS:"
    echo "  list-campaigns"
    echo "  get-campaign <id>"
    echo "  get-campaign-spec <id>"
    echo "  update-campaign-spec <id> <new_spec>"
    echo "  create-campaign <name> [spec]"
    echo "  add-to-campaign <person_id> <campaign_id>"
    echo "  remove-from-campaign <person_id>"
    echo "  get-campaign-context <person_id>"
    echo "  list-campaign-members <campaign_id>"
    ;;

  *)
    echo "ERROR: Unknown command '$1'. Run with 'help' to see available commands."
    exit 1
    ;;

esac

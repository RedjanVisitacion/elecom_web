"""Election-scoped party identity and shared logo helpers."""
import hashlib


def party_key(name):
    value = str(name or '').strip().lower()
    return '' if value in ('', 'independent') else value


def lock_party(cur, election_id, name):
    key = party_key(name)
    if key:
        digest = hashlib.sha256(f'{election_id or 0}:{key}'.encode()).digest()
        cur.execute('SELECT pg_advisory_xact_lock(%s)', [int.from_bytes(digest[:8], 'big', signed=True)])


def party_rows(cur, election_id, name):
    if not party_key(name):
        return []
    cur.execute("""
        SELECT party_name, party_code_hash, party_code, party_logo_url FROM (
            SELECT party_name, party_code_hash, party_code, party_logo_url, created_at, id, 0 AS source
            FROM candidates_registration
            WHERE COALESCE(election_id, 0) = COALESCE(%s, 0)
              AND LOWER(TRIM(COALESCE(party_name, ''))) = %s
            UNION ALL
            SELECT party_name, party_code_hash, party_code, party_logo_url, created_at, id, 1 AS source
            FROM candidate_applications
            WHERE COALESCE(election_id, 0) = COALESCE(%s, 0)
              AND LOWER(TRIM(COALESCE(party_name, ''))) = %s
        ) party ORDER BY source, created_at ASC NULLS LAST, id
    """, [election_id, party_key(name), election_id, party_key(name)])
    return cur.fetchall()


def canonical_logo(cur, election_id, name, proposed=None):
    rows = party_rows(cur, election_id, name)
    return next((str(row[3]).strip() for row in rows if row[3] and str(row[3]).strip()), proposed)


def share_logo(cur, election_id, name, logo):
    if not party_key(name):
        return 0
    changed = 0
    for table in ('candidates_registration', 'candidate_applications'):
        cur.execute(f"""UPDATE {table} SET party_logo_url = %s
            WHERE COALESCE(election_id, 0) = COALESCE(%s, 0)
              AND LOWER(TRIM(COALESCE(party_name, ''))) = %s
              AND party_logo_url IS DISTINCT FROM %s""",
            [logo, election_id, party_key(name), logo])
        changed += max(cur.rowcount, 0)
    return changed

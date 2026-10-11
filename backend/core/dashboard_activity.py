"""Read-only admin activity metadata; no voter IDs or ballot contents."""
from datetime import datetime, timezone

def load_dashboard_activity(connection, vote_activity):
    events = [{"kind": "vote", "title": "Votes cast", "detail": f"{item['count']} votes recorded in this hour", "timestamp": item["period_start"]} for item in vote_activity]
    complete = True
    sources = [
        ("biometric", "Biometric verified", "Face match confirmed", "SELECT verified_at FROM face_verification_logs WHERE verification_status='passed' ORDER BY verified_at DESC LIMIT 12"),
        ("network", "Network authorized", "Campus network access authorized", "SELECT created_at FROM network_access_attempts WHERE LOWER(status) IN ('allowed', 'active', 'authorized') ORDER BY created_at DESC, id DESC LIMIT 12"),
    ]
    for kind, title, detail, query in sources:
        try:
            with connection.cursor() as cur:
                cur.execute(query)
                rows = cur.fetchall()
            for (timestamp,) in rows:
                if timestamp:
                    if timestamp.tzinfo is None:
                        timestamp = timestamp.replace(tzinfo=timezone.utc)
                    events.append({"kind": kind, "title": title, "detail": detail, "timestamp": timestamp.isoformat()})
        except Exception:
            complete = False
    events.sort(key=lambda event: datetime.fromisoformat(event["timestamp"]), reverse=True)
    return {"events": events[:25], "complete": complete}

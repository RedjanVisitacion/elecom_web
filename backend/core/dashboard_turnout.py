"""Coarse turnout metadata without voter identities or ballot references."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


MIN_PUBLIC_BUCKET = 5


def load_dashboard_turnout(connection, vote_filter, vote_params, now, election=None):
    zone = ZoneInfo("Asia/Manila")
    historical = (election or {}).get("status", "").lower() in {"closed", "finished", "completed"}
    if historical:
        # Query exact schedule bounds; include partial boundary hours in the chart.
        start = datetime.fromisoformat(election["start_at"]).astimezone(zone)
        end = datetime.fromisoformat(election["end_at"]).astimezone(zone)
        if end <= start:
            raise ValueError("Election end must follow its start")
    else:
        end = now.astimezone(zone).replace(minute=0, second=0, microsecond=0)
        start = end - timedelta(hours=24)
    first_hour = start.replace(minute=0, second=0, microsecond=0)
    with connection.cursor() as cur:
        cur.execute(
            f"""
            SELECT date_trunc('hour', v.created_at AT TIME ZONE 'Asia/Manila') AS hour,
                   COUNT(*) AS total
            FROM votes v
            WHERE ({vote_filter}) AND v.created_at >= %s AND v.created_at < %s
            GROUP BY 1 ORDER BY 1
            """,
            [*vote_params, start, end],
        )
        totals = {hour.replace(tzinfo=ZoneInfo("Asia/Manila")): int(count) for hour, count in cur.fetchall()}

    hourly = []
    hour = first_hour
    while hour < end:
        count = totals.get(hour, 0)
        withheld = 0 < count < MIN_PUBLIC_BUCKET
        hourly.append({
            "hour": hour.isoformat(),
            "count": None if withheld else count,
            "withheld": withheld,
        })
        hour += timedelta(hours=1)
    activity = [
        {"period_start": item["hour"], "count": item["count"]}
        for item in reversed(hourly)
        if item["count"] is not None and item["count"] >= MIN_PUBLIC_BUCKET
    ][:6]
    return {
        "hourly": hourly, "activity": activity,
        "scope": "historical" if historical else "latest_24_hours",
        "through": end.isoformat(), "timezone": "Asia/Manila",
        "minimum_bucket_size": MIN_PUBLIC_BUCKET,
    }

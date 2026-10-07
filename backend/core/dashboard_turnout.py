"""Coarse turnout metadata without voter identities or ballot references."""
from datetime import timedelta
from zoneinfo import ZoneInfo


MIN_PUBLIC_BUCKET = 5


def load_dashboard_turnout(connection, vote_filter, vote_params, now):
    end = now.astimezone(ZoneInfo("Asia/Manila")).replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(hours=24)
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
    for offset in range(24):
        hour = start + timedelta(hours=offset)
        count = totals.get(hour, 0)
        withheld = 0 < count < MIN_PUBLIC_BUCKET
        hourly.append({
            "hour": hour.isoformat(),
            "count": None if withheld else count,
            "withheld": withheld,
        })
    activity = [
        {"period_start": item["hour"], "count": item["count"]}
        for item in reversed(hourly)
        if item["count"] is not None and item["count"] >= MIN_PUBLIC_BUCKET
    ][:6]
    return {
        "hourly": hourly, "activity": activity,
        "through": end.isoformat(), "timezone": "Asia/Manila",
        "minimum_bucket_size": MIN_PUBLIC_BUCKET,
    }

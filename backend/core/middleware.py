import logging
import time


logger = logging.getLogger(__name__)

_LAST_TABLE_CHECK = 0.0
_CHECK_INTERVAL_SECONDS = 60.0


class EnsureSystemTablesMiddleware:
    """
    Recreate missing ELECOM table structures on live traffic.

    This is a safety net for accidental table drops. It cannot recover deleted
    rows; data recovery still requires a database backup.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        self._ensure_tables_if_due(request)
        return self.get_response(request)

    def _ensure_tables_if_due(self, request):
        global _LAST_TABLE_CHECK

        path = getattr(request, "path", "") or ""
        if path.startswith("/static/") or path.startswith("/favicon"):
            return

        now = time.monotonic()
        if now - _LAST_TABLE_CHECK < _CHECK_INTERVAL_SECONDS:
            return

        try:
            from .views import _ensure_all_system_tables

            _ensure_all_system_tables()
            _LAST_TABLE_CHECK = now
        except Exception:
            logger.exception("Automatic ELECOM table self-heal check failed.")

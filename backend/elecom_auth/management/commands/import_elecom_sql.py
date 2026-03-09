from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from elecom_auth.models import ElecomStudent, ElecomUser


def _parse_sql_value(value: str):
    v = value.strip()
    if v.upper() == "NULL":
        return None
    if v.startswith("'") and v.endswith("'"):
        inner = v[1:-1]
        inner = inner.replace("\\'", "'").replace("\\\\", "\\")
        return inner
    if v == "":
        return ""

    try:
        if "." in v:
            return float(v)
        return int(v)
    except ValueError:
        return v


def _split_tuple_values(tuple_body: str) -> list[str]:
    out: list[str] = []
    cur: list[str] = []
    in_str = False
    escape = False

    for ch in tuple_body:
        if escape:
            cur.append(ch)
            escape = False
            continue

        if ch == "\\" and in_str:
            cur.append(ch)
            escape = True
            continue

        if ch == "'":
            in_str = not in_str
            cur.append(ch)
            continue

        if ch == "," and not in_str:
            out.append("".join(cur).strip())
            cur = []
            continue

        cur.append(ch)

    out.append("".join(cur).strip())
    return out


def _extract_insert_block(sql_text: str, table: str) -> str | None:
    pattern = re.compile(rf"INSERT INTO `{re.escape(table)}`.*?VALUES\s*(.*?);", re.DOTALL | re.IGNORECASE)
    m = pattern.search(sql_text)
    if not m:
        return None
    return m.group(1)


def _extract_tuples(values_block: str) -> list[list[str]]:
    tuples: list[list[str]] = []
    i = 0
    n = len(values_block)

    while i < n:
        if values_block[i] != "(":
            i += 1
            continue

        i += 1
        start = i
        depth = 1
        in_str = False
        escape = False

        while i < n and depth > 0:
            ch = values_block[i]

            if escape:
                escape = False
                i += 1
                continue

            if in_str and ch == "\\":
                escape = True
                i += 1
                continue

            if ch == "'":
                in_str = not in_str
                i += 1
                continue

            if not in_str:
                if ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                    if depth == 0:
                        body = values_block[start:i]
                        tuples.append(_split_tuple_values(body))
                        i += 1
                        break

            i += 1

    return tuples


class Command(BaseCommand):
    help = "Import elecom SQL dump (MySQL) tables users/student into the current Postgres database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default=str(Path(__file__).resolve().parents[4] / "societree (5).sql"),
            help="Path to elecom/societree SQL dump",
        )
        parser.add_argument(
            "--tables",
            type=str,
            default="users,student",
            help="Comma-separated tables to import (users,student)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(options["path"]).expanduser().resolve()
        if not path.exists():
            raise CommandError(f"SQL file not found: {path}")

        tables = {t.strip() for t in str(options["tables"]).split(",") if t.strip()}

        sql_text = path.read_text(encoding="utf-8", errors="ignore")

        if "student" in tables:
            self._import_student(sql_text)

        if "users" in tables:
            self._import_users(sql_text)

    def _import_student(self, sql_text: str):
        block = _extract_insert_block(sql_text, "student")
        if not block:
            self.stdout.write(self.style.WARNING("No INSERT block found for table student."))
            return

        tuples = _extract_tuples(block)
        if not tuples:
            self.stdout.write(self.style.WARNING("No rows parsed for table student."))
            return

        ElecomStudent.objects.all().delete()

        objs = []
        for row in tuples:
            if len(row) != 10:
                raise CommandError(f"Unexpected student row length {len(row)}: {row}")

            vals = [_parse_sql_value(v) for v in row]
            objs.append(
                ElecomStudent(
                    id_number=int(vals[0]),
                    first_name=str(vals[1] or ""),
                    middle_name=str(vals[2] or ""),
                    last_name=str(vals[3] or ""),
                    course=str(vals[4] or ""),
                    year=int(vals[5] or 0),
                    section=str(vals[6] or ""),
                    email=str(vals[7] or ""),
                    phone_number=str(vals[8] or ""),
                    role=str(vals[9] or ""),
                )
            )

        ElecomStudent.objects.bulk_create(objs, batch_size=1000)
        self.stdout.write(self.style.SUCCESS(f"Imported student rows: {len(objs)}"))

    def _import_users(self, sql_text: str):
        block = _extract_insert_block(sql_text, "users")
        if not block:
            self.stdout.write(self.style.WARNING("No INSERT block found for table users."))
            return

        tuples = _extract_tuples(block)
        if not tuples:
            self.stdout.write(self.style.WARNING("No rows parsed for table users."))
            return

        ElecomUser.objects.all().delete()

        objs = []
        for row in tuples:
            if len(row) != 17:
                raise CommandError(f"Unexpected users row length {len(row)}: {row}")

            vals = [_parse_sql_value(v) for v in row]

            created_at = parse_datetime(str(vals[3])) if vals[3] else None
            if created_at is None:
                try:
                    created_at = datetime.fromisoformat(str(vals[3]))
                except Exception:
                    created_at = datetime.utcnow()

            otp_expires_at = parse_datetime(str(vals[12])) if vals[12] else None
            terms_accepted_at = parse_datetime(str(vals[13])) if vals[13] else None

            objs.append(
                ElecomUser(
                    id=int(vals[0]),
                    student_id=str(vals[1]) if vals[1] is not None else None,
                    password_hash=str(vals[2] or ""),
                    created_at=created_at,
                    role=str(vals[4] or "user"),
                    department=str(vals[5]) if vals[5] is not None else None,
                    year_level=int(vals[6]) if vals[6] is not None else None,
                    section=str(vals[7]) if vals[7] is not None else None,
                    position=str(vals[8]) if vals[8] is not None else None,
                    phone=str(vals[9]) if vals[9] is not None else None,
                    email=str(vals[10]) if vals[10] is not None else None,
                    otp_code=str(vals[11]) if vals[11] is not None else None,
                    otp_expires_at=otp_expires_at,
                    terms_accepted_at=terms_accepted_at,
                    first_name=str(vals[14]) if vals[14] is not None else None,
                    middle_name=str(vals[15]) if vals[15] is not None else None,
                    last_name=str(vals[16]) if vals[16] is not None else None,
                )
            )

        ElecomUser.objects.bulk_create(objs, batch_size=1000)
        self.stdout.write(self.style.SUCCESS(f"Imported users rows: {len(objs)}"))

"""Shared identity formatting for the mobile and web APIs."""


def normalize_middle_name(value) -> str:
    """Treat an absent middle name or an N/A placeholder as blank."""
    name = str(value or "").strip()
    if name.casefold().replace(" ", "") in {"n/a", "na", "n.a.", "notapplicable"}:
        return ""
    return name


def identity_row(columns, values) -> dict:
    """Serialize a database row with a displayable optional middle name."""
    row = dict(zip(columns, values))
    if "middle_name" in row:
        row["middle_name"] = normalize_middle_name(row["middle_name"])
    return row


def full_name(first, middle, last) -> str:
    return " ".join(
        part for part in (
            str(first or "").strip(),
            normalize_middle_name(middle),
            str(last or "").strip(),
        ) if part
    )

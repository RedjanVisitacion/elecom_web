"""Bounded-memory inspection and sanitization of SQL backup files."""
from pathlib import Path


def inspect_sql(path: Path, markers=()) -> tuple[str, set[str]]:
    """Find case-insensitive markers, including those split across chunks."""
    markers = set(markers)
    overlap = max((len(marker) for marker in markers), default=1) - 1
    found = set()
    with path.open('r', encoding='utf-8', errors='ignore') as source:
        header = source.read(2048).lower()
        source.seek(0)
        tail = ''
        while chunk := source.read(65536):
            text = tail + chunk.lower()
            found.update(marker for marker in markers if marker in text)
            tail = text[-overlap:] if overlap else ''
    return header, found


def sanitize_data_sql(source_path: Path, output_path: Path) -> None:
    """Preserve data SQL while skipping the unsupported PostgreSQL setting."""
    with source_path.open('r', encoding='utf-8', errors='ignore') as source:
        with output_path.open('w', encoding='utf-8', newline='\n') as output:
            line_start = True
            # A certificate/image value can itself occupy a multi-MB SQL line.
            # Bound reads even within a single INSERT statement.
            while line := source.readline(65536):
                if line_start and line.strip().lower().startswith('set transaction_timeout'):
                    output.write('-- Skipped unsupported PostgreSQL setting: ')
                output.write(line)
                line_start = line.endswith('\n')

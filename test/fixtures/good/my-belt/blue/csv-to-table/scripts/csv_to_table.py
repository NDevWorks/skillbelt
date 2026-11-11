#!/usr/bin/env python3
"""Print a CSV file as a GitHub-flavoured Markdown table."""
import csv
import sys


def fail(message: str) -> None:
    print(f"csv_to_table: {message}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: csv_to_table.py FILE.csv")
    path = sys.argv[1]
    try:
        with open(path, newline="", encoding="utf-8-sig") as f:
            rows = [row for row in csv.reader(f) if any(cell.strip() for cell in row)]
    except FileNotFoundError:
        fail(f"file not found: {path}")
    if not rows:
        fail(f"{path} is empty")

    header = [c.strip() for c in rows[0]]
    width = len(header)
    lines = [header, ["---"] * width]
    for number, row in enumerate(rows[1:], start=2):
        if len(row) > width:
            fail(f"line {number} has {len(row)} cells, expected {width}")
        lines.append([c.strip() for c in row] + [""] * (width - len(row)))

    for cells in lines:
        print("| " + " | ".join(c.replace("|", "\\|") for c in cells) + " |")


if __name__ == "__main__":
    main()

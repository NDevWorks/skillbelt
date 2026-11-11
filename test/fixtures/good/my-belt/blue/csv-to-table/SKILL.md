---
name: csv-to-table
description: Converts CSV files into GitHub-flavoured Markdown tables, handling quoted fields, Windows line endings and pipe characters. Use when the user wants a CSV, spreadsheet export or comma-separated data shown as a Markdown table in a README, issue or chat.
---

# CSV to Markdown table

Run the script instead of converting by hand:

```bash
python scripts/csv_to_table.py path/to/file.csv
```

It prints the table to stdout. On failure it exits with a non-zero code and explains the problem on stderr; fix the CSV and run it again.

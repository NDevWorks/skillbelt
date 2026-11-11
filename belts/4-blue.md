# Blue belt: skills that run code

**Goal:** bundle a script so the agent runs tested code instead of redoing the work by hand every time.

Agents are good at writing code, but writing the same converter on every request is slow, costs tokens and can come out slightly different each time. A script inside the skill runs the same way every time, and only its *output* enters the conversation.

This belt has a fixed exercise so the grader can run your script against real test files.

## Learn

```
csv-to-table/
├── SKILL.md
└── scripts/
    └── csv_to_table.py      (or csv_to_table.mjs / csv_to_table.js)
```

In SKILL.md, tell the agent to **run** the script, not to read it:

````markdown
Run the script instead of converting by hand:

```bash
python scripts/csv_to_table.py path/to/file.csv
```
````

### Good scripts fail loudly

When something goes wrong, the agent only knows if your script tells it:

- **Exit with a non-zero code** (`sys.exit(1)` / `process.exit(1)`).
- **Write the error to stderr**, not stdout.
- **Say exactly what's wrong and where:** `line 7 has 4 cells, expected 3` lets the agent fix the CSV; `Error` doesn't.

## Your task

Build `my-belt/blue/csv-to-table/` with a script that prints a CSV file as a Markdown table. Python 3 or Node.js 20+, standard library only (no `pip install` or npm packages).

The grader runs it from inside the skill folder like this:

```bash
python3 scripts/csv_to_table.py /path/to/test.csv      # .py
node scripts/csv_to_table.mjs /path/to/test.csv        # .mjs or .js
```

### Output format (must match exactly)

Input:

```csv
product,price,notes
"Rice, 5kg",420,"Store in a ""dry"" place"
```

Output on stdout:

```markdown
| product | price | notes |
| --- | --- | --- |
| Rice, 5kg | 420 | Store in a "dry" place |
```

1. The first non-blank line is the header.
2. Every row is written as `| ` + cells joined with ` | ` + ` |`.
3. After the header comes a separator row with one `---` per column: `| --- | --- | --- |`.
4. Normal CSV quoting: a comma inside `"..."` is part of the cell, and `""` inside quotes is one `"`. Quoted fields don't span lines.
5. Trim spaces around every cell.
6. Write a `|` inside a cell as `\|`, so it doesn't break the table.
7. Files are UTF-8 (possibly with a BOM) with `\n` or `\r\n` line endings. Keep non-English text as it is.
8. Skip blank lines.
9. A row with **fewer** cells than the header is padded with empty cells: `1,2` under `a,b,c` becomes `| 1 | 2 |  |`.
10. A file with only a header prints the header and separator rows.

### Errors (exit non-zero, message on stderr)

| Situation | Message must contain |
|---|---|
| The file doesn't exist | `not found` (or "no such file" / "does not exist") |
| The file is empty or only blank lines | `empty` |
| A row has **more** cells than the header | the line number in the file, e.g. `line 2 has 3 cells, expected 2` |

Line numbers count every line in the file, starting at 1, including blank ones.

### The grader checks everything from Yellow belt, plus:

- [ ] Skill is named `csv-to-table`
- [ ] Has scripts/csv_to_table.py (or .mjs / .js)
- [ ] SKILL.md tells the agent to run the script (mentions `scripts/csv_to_table` and the word *run* or *execute*)
- [ ] Script: basic table
- [ ] Script: quoted fields with commas and `""` quotes
- [ ] Script: trims spaces and escapes |
- [ ] Script: Windows line endings and Tamil text
- [ ] Script: pads short rows and skips blank lines
- [ ] Script: header-only file
- [ ] Script: fails clearly when the file is missing
- [ ] Script: fails clearly on an empty file
- [ ] Script: rejects rows with too many cells, naming the line

The test files are in [`grader/fixtures/csv/`](../grader/fixtures/csv). Each `.csv` has a matching `.expected.md`. Run your script on them yourself while you work.

```bash
npm run grade -- blue
```

When the output differs, the grader shows the first line that's wrong, what it expected and what it got.

## Try it with your agent

Install the skill, paste a CSV (or point at a file) and ask for a Markdown table. The agent should run your script rather than writing its own code. If it doesn't, make the "run the script" instruction clearer and put it near the top of SKILL.md.

## Common mistakes

- **Splitting on commas** with `line.split(",")`. It breaks on `"Rice, 5kg"`. Use Python's `csv` module, or handle quotes yourself in JavaScript.
- **Printing errors to stdout** or exiting with code 0 after an error.
- **Forgetting `encoding="utf-8-sig"`** in Python, which leaves a BOM in the first header cell.
- **Trailing spaces** at the end of lines. Each line must end in `|`.

Next: [Black belt](5-black.md)

# Green belt: progressive disclosure

**Goal:** keep `SKILL.md` short and move detail into reference files the agent reads only when it needs them.

Everything in `SKILL.md` is loaded the moment the skill triggers. Long tables, policy text and examples there cost tokens on every use, even when they aren't needed. The fix is **progressive disclosure**:

1. **Frontmatter** is always loaded (a few words).
2. **SKILL.md body** is loaded when the skill triggers. Keep it to the steps.
3. **Reference files** are loaded only when a step points to them.

## Learn

```
reviewing-rental-agreements/
├── SKILL.md
└── references/
    ├── typical-terms.md
    └── red-flags.md
```

```markdown
# Reviewing rental agreements

1. Read the agreement and list rent, deposit, term, lock-in and notice period.
2. Compare each against the typical ranges in [typical terms](references/typical-terms.md).
3. Flag clauses that match the [red flags list](references/red-flags.md).
4. Reply with a short table: clause, what it says, why it matters, suggested change.
```

The agent reads `red-flags.md` only when it reaches step 3.

### Rules that keep it working

- **Link every reference file from SKILL.md.** A file nothing links to is never read.
- **Keep references one level deep.** `SKILL.md → references/a.md` is fine. `references/a.md → references/b.md` is not: agents often read only part of a nested file and miss the rest.
- **Keep the SKILL.md body under 500 lines.** If it's longer, split it.
- **Start long files with a table of contents.** For any file over 100 lines, add a `## Contents` heading near the top listing the sections, so the agent can jump to the right part.
- **Links must work.** Check spelling and folder names.

```markdown
# Typical rental terms

## Contents
- Security deposit
- Lock-in period
- Notice period
- Maintenance

## Security deposit
...
```

## Your task

Create **one** skill in `my-belt/green/` with at least one reference file.

```
my-belt/green/<your-skill-name>/
├── SKILL.md
└── references/
    └── <something>.md
```

The grader checks everything from Yellow belt, plus:

- [ ] Has at least one file in references/
- [ ] SKILL.md links to every reference file
- [ ] Every relative link in SKILL.md works (links inside code blocks are ignored)
- [ ] References are one level deep (reference files don't link to other `.md` files)
- [ ] SKILL.md body is under 500 lines
- [ ] Long reference files (over 100 lines) start with a table of contents

```bash
npm run grade -- green
```

## Try it with your agent

Install it and ask a question that needs a detail that lives only in a reference file. Watch the agent open that file. Then ask something that needs only the main steps; it shouldn't open the references at all.

## Common mistakes

- **Mentioning a file without linking it.** Write `[red flags](references/red-flags.md)`, not "see the red flags file".
- **Absolute or Windows paths** like `/home/me/skill/references/a.md` or `references\a.md`.
- **Moving the steps into references.** The workflow stays in SKILL.md; references hold the detail.

Next: [Blue belt](4-blue.md)

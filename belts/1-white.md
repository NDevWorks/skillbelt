# White belt: your first skill

**Goal:** write a skill that any agent can load without errors.

A **skill** is a folder with a `SKILL.md` file inside. The top of the file (the *frontmatter*) tells the agent what the skill is called and when to use it. The rest is plain Markdown instructions the agent follows once it decides to use the skill.

Agents only read the frontmatter of every installed skill at startup. They read the full instructions only when a request matches. That's why skills are cheap to install and why the frontmatter has strict rules.

## Learn

```
my-skill-name/
└── SKILL.md
```

```markdown
---
name: writing-commit-messages
description: Writes clear git commit messages from staged changes. Use when the user asks for a commit message.
---

# Writing commit messages

1. Run `git diff --staged` to see what changed.
2. Write a summary line under 72 characters, in the imperative ("Add", "Fix").
3. Add a blank line, then explain why the change was made.
```

### The rules for `name`

| ✅ Good | ❌ Bad | Why |
|---|---|---|
| `writing-commit-messages` | `Writing-Commit-Messages` | Lowercase only |
| `pdf-forms` | `pdf_forms` | Hyphens, not underscores |
| `csv-to-table` | `csv--to-table`, `-csv` | No double, leading or trailing hyphens |
| `reviewing-leases` | `claude-lease-helper` | `claude` and `anthropic` are reserved |

- 1 to 64 characters.
- **Must match the folder name.** Folder `pdf-forms/` → `name: pdf-forms`.

### The rules for `description`

- Required, 1 to 1024 characters.
- No XML or HTML tags like `<b>`.
- You'll learn to write a *great* description in the Yellow belt. For now, just say what it does.

### Optional fields

Only these are allowed in the frontmatter. Anything else goes under `metadata`.

```yaml
license: MIT
compatibility: Needs Python 3.10+ and internet access
allowed-tools: Bash(git:*) Read
metadata:
  author: your-name
  version: "1.0"      # quote numbers: metadata values must be text
```

### Paths

Always use forward slashes: `references/guide.md`, never `references\guide.md`. Skills run on Linux, macOS and Windows.

## Your task

Create **one** skill in `my-belt/white/`, about anything you know well.

```
my-belt/white/<your-skill-name>/SKILL.md
```

The grader checks:

- [ ] Has a SKILL.md file
- [ ] Frontmatter is valid YAML (between two `---` lines, at the very top)
- [ ] `name` is present
- [ ] `name` uses lowercase letters, digits and single hyphens (max 64)
- [ ] `name` matches the folder name
- [ ] `name` avoids reserved words
- [ ] `description` is present (max 1024 characters)
- [ ] No XML tags in `name` or `description`
- [ ] Optional fields are valid
- [ ] Has instructions below the frontmatter (at least a few lines)
- [ ] Uses forward slashes in paths

Want quick feedback while you write? Paste your SKILL.md into the [playground](https://skillbelt.vercel.app). It runs the same checks in your browser.

Check your work:

```bash
npm run grade -- white
```

Then commit and push. Your fork's Actions tab shows the same report, and your badge updates.

## Try it with your agent

In **Claude Code**, copy the folder into `.claude/skills/` in any project (or `~/.claude/skills/` for all projects), start a new session and ask something that matches your description. Other agents that support the [Agent Skills format](https://agentskills.io) load the same folder; check their docs for where skills go.

## Common mistakes

- **Text before the first `---`.** Even a blank line or a heading breaks the frontmatter.
- **Tabs in YAML.** Use spaces.
- **A colon in the description**, like `description: Fixes bugs: fast`. Wrap it in quotes: `description: "Fixes bugs: fast"`.
- **Renaming the folder but not `name`** (or the other way round).
- **Two skills in `my-belt/white/`.** Keep exactly one per belt.

Next: [Yellow belt](2-yellow.md)

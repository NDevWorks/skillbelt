# Black belt: test it and ship it

**Goal:** build an original skill, prove it triggers at the right time with evaluations, and join the Hall of Black Belts.

You've learned the format, descriptions, references and scripts. The last step is what separates a skill that works once from one people can rely on: **evaluations**. Write them before you polish the skill, so you know what "working" means.

## Learn

### Evaluations

An evaluation is a realistic request and what a correct answer does with it. Keep them in `evals/evals.json`:

```json
[
  {
    "query": "Make a GST invoice for 10 cotton sarees sold from Coimbatore to a shop in Bengaluru",
    "expected_behavior": [
      "Uses IGST because the sale is interstate",
      "Asks for or flags missing GSTIN and HSN code"
    ]
  },
  {
    "query": "Check this bill: Chennai seller, Madurai buyer, they charged IGST 5%",
    "expected_behavior": ["Points out that a same-state sale needs CGST + SGST, not IGST"]
  },
  {
    "query": "Is 33ABCDE1234F1Z5 a valid looking GSTIN for Tamil Nadu?",
    "expected_behavior": ["Checks length, state code 33 and the Z character"]
  },
  {
    "query": "Write a thank-you email to a customer who paid their invoice",
    "should_trigger": false
  }
]
```

| Field | Meaning |
|---|---|
| `query` | What a real user would type. Be specific; include names, numbers and messy details. |
| `expected_behavior` | A list of things a correct answer does. Each one should be checkable: yes or no. |
| `should_trigger` | Optional. `false` marks a look-alike request the skill should **not** handle. Defaults to `true`. |

The `should_trigger: false` case matters. "Invoice" appears in the thank-you email request, but it's not a GST invoice task. If your skill triggers on it, your description is too broad.

### Running your evals

The grader checks the file is well formed. Running them is up to you:

1. Ask each `query` in a fresh agent session **without** the skill installed. Note what goes wrong.
2. Install the skill and ask again. Check each `expected_behavior`.
3. For `should_trigger: false` cases, confirm the skill isn't used.
4. Fix the skill, add a new eval for anything that surprised you, and repeat.

### Shipping

- **Add a `license`** so others know they can reuse it: `license: MIT`.
- **Bundle something**: a script in `scripts/` or detail in `references/` (or both).
- **Be original.** Pick a task you know better than most people: your job, your city, your language, your hobby. Those make the most useful skills.

## Your task

Create **one** original skill in `my-belt/black/`:

```
my-belt/black/<your-skill-name>/
├── SKILL.md
├── evals/
│   └── evals.json
└── scripts/ or references/
```

The grader checks everything from Yellow belt, plus:

- [ ] Reference rules from Green belt, if you have a references/ folder
- [ ] Has scripts/ or references/ (more than one file)
- [ ] Has a `license` field
- [ ] Has evals/evals.json with at least 3 cases (each with a `query` of 10+ characters, and `expected_behavior` unless `should_trigger` is `false`)
- [ ] Evals include a case that should NOT trigger the skill
- [ ] Is your own skill (not the Blue belt exercise)

```bash
npm run grade
```

When every belt passes, push. Your badge turns black.

## Join the Hall of Black Belts

1. Push to your fork and wait for the **Grade** action to finish. Check that your badge says **black belt**.
2. On the original repo, open [`BLACK_BELTS.md`](../BLACK_BELTS.md) and click the pencil icon to edit it. GitHub creates a branch in your fork for you.
3. Add **one** row at the bottom, using your GitHub username and skill name:

   ```markdown
   | [@your-username](https://github.com/your-username) | [your-skill](https://github.com/your-username/skillbelt/tree/main/my-belt/black/your-skill) | One line on what your skill does |
   ```

   The last column is plain text, 10 to 120 characters, without links.

4. Open the pull request. The **Hall** check confirms your badge says black belt, your skill exists in your fork and the row is yours. When it's green, it gets merged.

## Common mistakes

- **Evals that only use the skill's own words.** Real users don't know your description. Write queries the way they'd actually ask.
- **Vague expectations** like "gives a good answer". Write things you can check.
- **Changing other files in the Hall pull request.** Only `BLACK_BELTS.md`.
- **Editing the hall from your fork's copy** that's behind the original. Edit it on the original repo so you add to the latest list.

🥋 Then share your skill. Every black-belt skill in the hall is something another person can install.

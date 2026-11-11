# Contributing

Thanks for helping make Skillbelt better.

## Joining the Hall of Black Belts

That's a pull request too, but it has its own steps. See the [Black belt lesson](belts/5-black.md#join-the-hall-of-black-belts).

## Reporting a grader problem

Open an issue with:

- the belt,
- your `SKILL.md` (and any other files the check looked at),
- the message the grader printed,
- why you think it's wrong.

If the rule itself is out of date with the [Agent Skills specification](https://agentskills.io/specification), link the part of the spec that changed.

## Changing the grader or the lessons

```bash
npm install
npm test
```

- Rules live in [`grader/lib/skill.mjs`](grader/lib/skill.mjs) (format, descriptions, references) and [`grader/lib/belts.mjs`](grader/lib/belts.mjs) (scripts, evals, belt order).
- Every rule has a test in [`test/grader.test.mjs`](test/grader.test.mjs) that breaks a good skill and checks the rule catches it. Add one for any new rule.
- [`test/fixtures/good/`](test/fixtures/good) holds example answers that pass every belt. Please don't copy them for your own belts; you'll learn far more writing your own.
- If you change a rule, update the checklist in the matching lesson in [`belts/`](belts) so they always agree.
- The website (playground and belt cards) is in [`site/`](site). It bundles the same rules from `grader/lib/rules.mjs`, so a rule change shows up there too. Try it with `cd site && npm install && npm run dev`.
- Messages should tell the learner exactly how to fix the problem, in plain words.

## Translations

Lessons in other languages are welcome. Put them in `belts/<language-code>/`, for example `belts/ta/1-white.md`, and link them from the README.

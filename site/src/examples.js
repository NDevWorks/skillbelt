// Starting points for the playground. The good ones are the same files the grader's tests use.
import greenSkill from "../../test/fixtures/good/my-belt/green/reviewing-rental-agreements/SKILL.md";
import greenTerms from "../../test/fixtures/good/my-belt/green/reviewing-rental-agreements/references/typical-terms.md";
import greenFlags from "../../test/fixtures/good/my-belt/green/reviewing-rental-agreements/references/red-flags.md";
import blackSkill from "../../test/fixtures/good/my-belt/black/drafting-gst-invoices/SKILL.md";
import blackGstin from "../../test/fixtures/good/my-belt/black/drafting-gst-invoices/references/gstin-format.md";
import blackLayout from "../../test/fixtures/good/my-belt/black/drafting-gst-invoices/references/invoice-layout.md";
import blackEvals from "../../test/fixtures/good/my-belt/black/drafting-gst-invoices/evals/evals.json";

export const EXAMPLES = [
  {
    id: "vague",
    title: "A weak skill to fix",
    folder: "pdf-helper",
    files: {
      "SKILL.md": `---
name: PDF-Helper
description: I help you with PDFs and stuff.
---

# PDF helper

Do PDF things.
`,
    },
  },
  {
    id: "blank",
    title: "Blank skill",
    folder: "my-new-skill",
    files: {
      "SKILL.md": `---
name: my-new-skill
description:
---

# My new skill

1.
`,
    },
  },
  {
    id: "green",
    title: "Green belt example",
    folder: "reviewing-rental-agreements",
    files: {
      "SKILL.md": greenSkill,
      "references/typical-terms.md": greenTerms,
      "references/red-flags.md": greenFlags,
    },
  },
  {
    id: "black",
    title: "Black belt example",
    folder: "drafting-gst-invoices",
    files: {
      "SKILL.md": blackSkill,
      "references/gstin-format.md": blackGstin,
      "references/invoice-layout.md": blackLayout,
      "evals/evals.json": JSON.stringify(blackEvals, null, 2) + "\n",
    },
  },
];

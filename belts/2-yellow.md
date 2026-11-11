# Yellow belt: descriptions that trigger

**Goal:** write a description that makes the agent pick your skill at the right moment, and only then.

An agent may have a hundred skills installed. It decides which one to use by reading **only the descriptions**. A vague description means your skill never runs, or runs when it shouldn't.

A good description answers two questions:

1. **What does it do?** Specific actions and the things it works on.
2. **When should it be used?** The words a user would actually type.

## Learn

```yaml
# ❌ Too vague: the agent can't tell when this applies
description: Helps with addresses.

# ❌ What, but not when
description: Formats Indian postal addresses with door number, street, city, state and PIN code.

# ✅ What + when, with words users really say
description: Formats Indian postal addresses into a clean, consistent layout with door number, street,
  area, city, district, state and 6-digit PIN code. Use when the user pastes a messy address, asks to
  clean up shipping labels, or mentions PIN codes, courier forms or delivery addresses in India.
```

### Write in the third person

The description is put into the agent's own instructions. "I can help you…" reads as if the agent is talking about itself.

| ✅ | ❌ |
|---|---|
| Formats invoices… | I format invoices… |
| Reviews pull requests… | You can use this to review pull requests… |

### Name it after the action

Prefer a verb + object, often in the *-ing* form: `formatting-addresses`, `reviewing-leases`, `analyzing-logs`. Names like `helper`, `utils`, `tools`, `my-skill` or `misc` tell the agent nothing.

### Include the trigger words

Think about how people ask. Someone who needs your address skill might say "PIN code", "courier", "shipping label" or "delivery address". Put those words in the description.

## Your task

Create **one** skill in `my-belt/yellow/`. It can be a better version of your White belt skill or something new.

The grader checks everything from White belt, plus:

- [ ] Description is detailed enough (80+ characters)
- [ ] Description says when to use it: include a phrase like "Use when…" or "…when the user…"
- [ ] Description is in the third person: no *I*, *me*, *my* or *you*
- [ ] Description is specific, not vague: avoid *helps with*, *stuff*, *things*, *various*, *etc.*, and use at least 8 different meaningful words
- [ ] Name is descriptive: not `helper`, `utils`, `tools`, `misc`, `my-skill` and so on

```bash
npm run grade -- yellow
```

## Try it with your agent

Install the skill (see the White belt), then test it three ways:

1. A request that **should** use it, worded the way a real user would.
2. The same request worded differently. Does it still trigger?
3. A **look-alike** request that shouldn't use it. For the address skill: "What's the capital of Kerala?"

If 1 or 2 fails, add the missing words to the description. If 3 triggers, make the description narrower.

## Common mistakes

- **Describing the skill instead of the task:** "A skill for addresses" says nothing the name doesn't.
- **Only saying "when".** "Use when the user asks" is too short; say *what* they ask.
- **Stuffing keywords.** A list of 40 words reads like spam to the agent too. Write two clear sentences.

Next: [Green belt](3-green.md)

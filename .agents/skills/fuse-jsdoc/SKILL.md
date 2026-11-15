---
name: fuse-jsdoc
description: "Fuse JSDoc voice: openers, terms, defaults, spelling and plain-language rules. Use when writing, rewriting or reviewing a JSDoc or TSDoc block in packages/fuse."
---

# Fuse JSDoc

A block's job is to tell a reader what the symbol is, and any rule the reader must follow. The reader can be a person or an agent. Prop blocks appear as rows in the API reference and the `/components/<slug>.md` endpoint. Every block is held to the same voice, so a fact reads the same wherever it appears.

## Openers

Open with one plain sentence that names the thing. Pick the form by kind:

| Kind | Opener | Example |
|---|---|---|
| Prop or field holding a value | Noun phrase | "The menu's label." "Accessible name of the first-page button." |
| Boolean prop or field | "Whether …" | "Whether the picker shows as invalid." |
| Callback prop | "Called when …" | "Called when the open state changes." |
| Component or part | What it renders, as a noun phrase | "The row's trailing controls, centered on the row." |
| Props type | "Props for `X`." | "Props for `GaugeChart.Track`, a closed part." |
| Function or hook | What it returns, as a noun phrase, or a present-tense verb for an action | "The nearest series to the pointer." "Creates a toast manager." |

- A field or method holding a function opens like a function, with a present-tense verb. Only a callback the code calls on an event opens "Called when …".
- A part that performs an action still opens with a noun phrase: "The button that opens the popover."
- A boolean opens "Whether …" whatever its name: "Whether to hide …" for an opt-in, "Whether … is hidden" for a state.
- A props type that adds a fact folds it in: "Props for `Table.Root`, a native `table`'s props."
- A note that a module is package-private goes in its own sentence after the opener.

After the opener, give the rules a consumer must follow as instructions: "Pass `aria-label` when …", "Render it inside `Dialog.Content`." Give each fact once, on the symbol it concerns.

## Terms

- **consumer**: the developer who uses Fuse. Address the consumer in the imperative. Do not use "you" or "your".
- **user**: the person using the app built with Fuse.
- **host**: the app that renders Fuse and owns brand, density, first-paint HTML and code splitting.
- **part**: a namespace member such as `Dialog.Trigger`. Write it with its namespace, in backticks.
- **slot**: a recipe slot or a `data-slot` value. Use it for styling hooks only.

Use one term per concept for the whole block. Pick the term from this list over a synonym.

## Defaults

- A default declared by destructuring, such as `variant = "default"`, is recorded by the generator. Leave it out of the prose.
- Write "Defaults to …" only for a default the signature does not declare, such as "Defaults to the locale dictionary." A default declared as a named constant, such as `windowMs = DEFAULT_WINDOW_MS`, keeps its value in the prose, because the API table shows only the name.
- Keep an existing `@default` tag. The generator reads it for props a dependency declares.

## Format

- Put code, prop names, values, attributes, CSS properties and part names in backticks. Keep each code span on one line, because TSDoc rejects a span that wraps.
- Escape `{`, `}` and `@` in prose with a backslash. TSDoc reads them as tags otherwise.
- Write `@param name - Description.` and `@returns Description.` as full sentences. Keep `@beta`, `@deprecated` and `{@link}` tags as they are.
- Write a string value with its quotes inside the span, `"snap"`, and `null`, `undefined` and `true` as spans. Put text a user reads or hears, such as a dictionary string, in straight quotes.
- Point to another symbol or file with "; see `x`." or ", in `file.ts`,".
- Use US spelling: color, center, behavior, gray, canceled, recognize, -ize. An identifier keeps its own spelling, so `centreOf` stays as it is in a span.
- Write large numbers with a comma: 100,000.
- Write ranges as words: "0 to 100".
- Use "such as" instead of "e.g." and "that is" instead of "i.e.".
- Use periods and commas. A colon may open a list or an example. A semicolon may join two short clauses about one fact.

## Plain language

These are the unslop rules that apply to JSDoc, by their stable numbers.

- **3.** Cut "-ing" tails that add an opinion, such as "…, ensuring a smooth experience".
- **7, 31.** Use the plain word: use, help, many, if, also, important. Cut crucial, robust, seamless, leverage, utilize, facilitate, additionally, enhance.
- **8.** Write "is" or "has" in place of "serves as", "acts as", "boasts" or "features".
- **9.** State the point. Cut "not just X, but Y".
- **11.** Keep one term for one thing in a block.
- **13.** Use no em dash or en dash, and no parentheses for an aside. End the sentence or use a comma.
- **14.** Use a colon only before a list or an example.
- **23.** Cut filler: "in order to" becomes "to", and "note that", "simply", "just" and "basically" go.
- **24.** Hedge once at most. "May" covers it.
- **26.** Use the concrete word in place of surface, primitive, harness, substrate, vector, paradigm or scaffolding used as metaphors.
- **27.** Name the mechanism or the value, not a feeling. Cut a sentence that could appear unchanged in another library's docs.
- **28.** One idea per sentence. Split a sentence the reader has to parse twice.
- **29.** Write in the active voice and name the actor: "the Root writes `data-open`", not "`data-open` is written". Passive is fine when the actor does not matter.
- **30.** Cut an adverb, or swap in a stronger verb or a number.
- **32.** Write the literal phrase. Code does not "hold", "own" or "ride along" unless it does so in code.
- **33.** Write whole sentences with articles and verbs. Spell out arrows and abbreviations.

## Precision

Each qualifier, such as "always", "only", "never", "every" or "at most", must be true of the code. When you rewrite a block, keep every fact it states. If a claim looks wrong or you cannot confirm it from the code beside it, keep it and report it instead of guessing.

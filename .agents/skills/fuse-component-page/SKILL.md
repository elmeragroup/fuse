---
name: fuse-component-page
description: "Fuse component page drafting: shape, demos, JSDoc and Live code gotchas. Use when writing or migrating a docs page under apps/docs/src/app/(docs)/components, adding or changing one of its demos, or when such a page fails generation, transparency or the Live code sweep."
---

# Fuse component page

The page shape and the one-subject rule live in the Documentation section of `AGENTS.md`. The Button page,
`apps/docs/src/app/(docs)/components/button/`, is the reference migration; copy its layout.
`pnpm gen` scaffolds a new page in the same shape.

## Steps

1. **List the examples.** Read the component's `api.json`. Each `values` entry of a recipe axis,
   such as `variant` or `size`, gets its own example. So does each state worth seeing, such as
   pending, disabled or a `render` swap. One instance of the page's component per stage, plus its own
   parts and plain HTML. Done when every recipe value has a stage.
2. **Move the prose out.** For each `<Prose>` fact, a rule a consumer must follow goes into the
   JSDoc of the prop it concerns. Component-level JSDoc reaches neither the API reference nor the
   `.md` endpoint, so a rule about children goes on a declared `children` prop. Implementation
   rationale goes into a comment beside its owner, usually the recipe file. Then delete the
   prose. Done when every deleted fact is findable on the HTML page or in the source.
3. **Rewrite the JSDoc you touched.** Open with what the prop does, in one plain sentence. State a
   rule as an instruction to the consumer, with the value or markup it names in backticks. Give
   each fact once, on the prop it concerns, and leave out how the component implements it. Cut
   filler: no "simply", "just", "note that", or restating the type.
4. **Declare real defaults** by destructuring, as in `variant = "default"`. The generator records a
   declared prop's default only from destructuring; it reads `@default` only for dependency
   props. A prop with no recorded default shows "unset" in Live code, which is correct when the
   default is unknown. Restating a recipe default this way is interim until the extractor records
   recipe defaults (elmeragroup/internal#39).
5. **Write the demos and the page**, then record the demo files in
   `apps/docs/test/fixtures/component-inventory.json` and run `pnpm --filter docs generate`.
6. **Run the gates** listed under Checks. Done when all pass and the sweep shows no new hang.

## Page rules generation enforces

- A page with `<DefaultDemo>` is held to the whole shape: the default stage before `## Usage`,
  `## Usage` then `## Examples` as the only headings, exactly one code block under Usage, only
  `level={3}` demos and all of them under Examples, and no `<Prose>`. Anything else fails
  generation, naming the rule.
- `<DefaultDemo>` comes once, untitled. It has no TOC entry and no markdown section. It gets the
  same file checks as a `<Demo>`: the file exists and starts with `"use client"`.
- On any page, a level-3 demo before the first `##` heading, a level 4, or a second
  `<DefaultDemo>` fails generation.
- Demo ids are unique, URL-safe, and differ from heading ids. Every file in `demos/` must be
  rendered by a frame, and every frame's `file` must exist.
- Put `{/* prettier-ignore */}` above the Usage fence. Without it oxfmt appends `;` to the JSX
  line.
- The TOC and the markdown endpoint come from `scripts/lib/page-source.ts` reading `page.mdx` in
  order.

## Demos and Live code

Live code wraps each Fuse part a component demo renders that has a settable prop, leaving out
parts Fuse recognises by element identity, and makes those props editable on the stage. The stage
control, in the frame's footer opposite the view switch, opens a menu of every site with a
settable prop, and the Code view shows the edited source.
These follow from how it works:

- Start a demo with `"use client"`. Live code skips server demos.
- Write each prop as a literal attribute. An expression value such as `variant={variant}`
  inside a `.map` is one site, so editing it changes every iteration and a matrix collapses.
- Editable props are the `api.json` rows with `values` or a boolean type. Forwarded props absent
  from `api.json`, such as Button's `disabled`, are not editable, and neither are `render` and
  `elementType`.
- `requires` hides a value whose companion props the site lacks. An `icon*` Button size needs
  `aria-label` on the demo before Live code offers it.
- A stage with one site opens the menu straight onto its props. Several sites, from a repeated
  part or a demo's popup parts such as a dropdown's items, each get a group labelled with the part
  and source line, and highlighting a row outlines that site's elements, the ones its `ref`
  reaches. A popup part stays in the menu while the popup is closed, and its edits apply when it
  opens.
- Use brand-neutral, realistic labels. Avoid app names and placeholder text.
- A part that Fuse recognises through `child.type === X` stays unwrapped. The generated `src/generated/live-code-identity-parts.json` lists those parts. A new comparison against a Fuse
  component that is not a documented part fails `generate`; document the part.
- An edit or a preview that throws is reverted with a notice. An edit that hangs is not: a value that makes a
  component loop or allocate without bound needs a guard in the component that throws, like
  Chart's `slot-limit`.
- Sugar-high highlighting stays in server modules, or `client-graph.test.ts` fails.

## Checks

Run from the ui root with Node 26.13 on the PATH, one heavy command at a time.

- `pnpm --filter docs exec vitest run --project unit test/live-code-transparency.test.ts test/generated-output.test.ts test/component-page.test.ts`.
  Transparency demands identical HTML with and without Live code. A diff usually means a shifted
  `useId` or an identity-compared part.
- `pnpm --filter docs live-code:sweep` renders every demo once per offered value. Read new
  entries in `.scratch/live-code-sweep/results.json`; a run that never finishes is a hang.
- `pnpm exec turbo run build:e2e --filter=docs`, then
  `pnpm --filter docs test:e2e test/routes.browser.test.ts test/live-code.browser.test.ts`.
- After a rebase, run `generate` again. On a conflict in a generated `api.json`, take main's
  version and regenerate.
- Take shots with `pnpm shots` after reading `tooling/pr-shots/README.md`. A whole-page reshape
  differs everywhere, so shoot before and after with `--no-diff`.

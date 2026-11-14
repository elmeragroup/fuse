---
name: fuse-component-page
description: "Fuse component page drafting: shape, demos, JSDoc and Live code gotchas. Use when writing or reshaping a docs page under apps/docs/src/app/(docs)/components, adding or changing one of its demos, or when such a page fails generation, transparency or the Live code sweep."
---

# Fuse component page

The page shape and the one-subject rule live in the Documentation section of `AGENTS.md`. The Button page,
`apps/docs/src/app/(docs)/components/button/`, is the reference page; copy its layout.
`pnpm gen` scaffolds a new page in the same shape.

## Steps

1. **List the examples.** Read the component's `api.json`. Each `values` entry of a recipe axis,
   such as `variant` or `size`, gets its own example. So does each state worth seeing, such as
   pending, disabled or a `render` swap. One instance of the page's component per stage, plus its own
   parts and plain HTML. Done when every recipe value has a stage.
2. **Stage controls as Buttons.** A clickable control that the subject does not style itself is
   a Fuse `Button`. Pass it to an unstyled part through `render`, as in
   `<Dialog.Trigger render={<Button variant="outline" />}>`, and write it in place of a native
   `<button>`. A trigger or a control that fires something defaults to `outline`, a destructive
   trigger is `destructive`, a main action, such as a footer's confirm or an upload trigger, is
   the default variant, and a `Toolbar.Button` is `ghost` `sm`. A link part the subject does not
   style takes `buttonVariants({ variant: "link" })`. Keep a native `<button>` only when it is the
   subject's own element, as in `Item.Root`'s `render`.
3. **Decide on Composition.** Add `## Composition` only when the component cannot be used
   correctly without knowing how its parts or sibling components fit together, as with Form and
   the fields inside it. Keep it to a few sentences. A rule about one prop never goes there; it
   goes on that prop. Adding a slug to `COMPOSITION_PAGES` needs a one-line reason beside it.
4. **Put each rule on its prop.** A rule a consumer must follow goes into the JSDoc of the prop
   it concerns. Component-level JSDoc reaches neither the API reference nor the `.md` endpoint,
   so a rule about children goes on a declared `children` prop. Implementation rationale goes
   into a comment beside its owner, usually the recipe file. Done when every rule a reader needs
   is on the HTML page.
5. **Rewrite the JSDoc you touched.** Open with what the prop does, in one plain sentence. State a
   rule as an instruction to the consumer, with the value or markup it names in backticks. Give
   each fact once, on the prop it concerns, and leave out how the component implements it. Cut
   filler: no "simply", "just", "note that", or restating the type.
6. **Declare real defaults** by destructuring, as in `variant = "default"`. The generator records a
   declared prop's default only from destructuring; it reads `@default` only for dependency
   props. A prop with no recorded default shows "unset" in Live code, which is correct when the
   default is unknown. Restating a recipe default this way is interim until the extractor records
   recipe defaults (elmeragroup/internal#39).
7. **Write the demos and the page**, then record the demo files in
   `apps/docs/test/fixtures/component-inventory.json` and run `pnpm --filter docs generate`.
8. **Run the gates** listed under Checks. Done when all pass and the sweep shows no new hang.

## Page rules generation enforces

- Every component page is held to the whole shape: the default stage before `## Usage`,
  `## Usage` then `## Examples` as the only headings, exactly one code block under Usage, only
  `level={3}` demos and all of them under Examples, and no `<Prose>`. Anything else fails
  generation, naming the page and the rule.
- The one exception is `## Composition` between Usage and Examples, on a slug listed in
  `COMPOSITION_PAGES` in `scripts/lib/page-source.ts` with its reason. Its body is one `<Prose>`
  block with at most one code block and no demo. The TOC, the ⌘K list and the `.md` endpoint show
  it after Usage.
- `<DefaultDemo>` comes once, untitled. It has no TOC entry and no markdown section. It gets the
  same file checks as a `<Demo>`: the file exists and starts with `"use client"`.
- A page with no `<DefaultDemo>` or a second one, or a `<Demo>` without `level={3}`, fails
  generation.
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

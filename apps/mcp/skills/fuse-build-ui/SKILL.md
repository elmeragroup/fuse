---
name: fuse-build-ui
description: Fuse (`@elmeragroup/fuse`) UI work in an app that has Fuse installed. Use when building or changing a screen with Fuse components, choosing the component for a need, or fixing a type error in Fuse code.
---

# Building UI with Fuse

Every href below is a `read_doc` argument. Pass several in one call. In `/components/<name>`, `<name>` is the page's last path segment, such as `button`.

## Steps

1. Find the components. Call `search_docs` with what each piece of the screen must do, such as "pick one option from a list" or "confirm before deleting". When none fits, read `/llms.txt`, which lists every page. Done when each piece maps to a component page, or to plain HTML when none fits.
2. Read each chosen page: `/components/<name>#overview`, `/components/<name>#usage` and `/components/<name>#api-reference`. When an answer's `Sections:` line lists Composition, read it; a page without one composes as its usage shows. The overview names the component for a nearby case, such as a form field. An answer too large for one call lists the hrefs under it; ask for the parts you use. Read a demo under `/components/<name>#examples` only when the screen needs it. Take each prop from the part's rows in the API reference, or from the usage or an example on its page that passes it to that part. A native attribute or event handler a part forwards, such as `onClick` or `type`, needs only step 5's type-check. Done when you have the import line, the part names and, for every other prop you will pass, the place on the page that shows it.
3. For a form, read `/components/field#composition` and `/components/form#composition`. Done when each control has a label and an error message wired through a field component or `Field.Root`.
4. Write the code. Use utility classes in your own markup, layout ones such as `flex` included, only when the app's build compiles Tailwind v4. The build compiles Tailwind v4 when it runs Tailwind's compiler over a stylesheet that imports `tailwindcss` or one of Tailwind's own sheets, such as `tailwindcss/utilities.css`. The compiler is the `@tailwindcss/vite` or `@tailwindcss/postcss` plugin in the build config, or the `@tailwindcss/cli` command in a script. Otherwise style your markup in your own CSS with role tokens such as `var(--card)`. Done when every Fuse import, part and prop in it comes from what you read in steps 2 and 3, forwarded native attributes and event handlers aside, and your own markup carries utility classes only in a Tailwind v4 build.
5. Run the project's type-check. Done when it exits 0. When it rejects a Fuse prop or part that the docs show, the installed package is older than the docs, which follow Fuse's `main` branch. Follow its type definitions in `node_modules/@elmeragroup/fuse`.

## Rules

- A namespace component is its parts, such as `Dialog.Root`, `Dialog.Trigger` and `Dialog.Content`, composed as its usage shows. To render a part as another element or component, pass that element to the part's `render` prop: `<Dialog.Trigger render={<Button />}>`.
- Fuse components take their look from the document's theme. A page such as `/components/button#tokens-consumed` lists the role tokens its component reads; a page without that section reads none.

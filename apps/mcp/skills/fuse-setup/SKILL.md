---
name: fuse-setup
description: Fuse (`@elmeragroup/fuse`) setup in a React app. Use when adding Fuse to an app, choosing its Tailwind or standalone CSS, or when Fuse components render unstyled.
---

# Fuse setup

Every href below is a `read_doc` argument. Pass several in one call.

## Steps

1. Read the project and `/quick-start#install`. Name the project's framework, its package manager, the module that renders `<html>`, and whether the app's build compiles Tailwind v4. The build compiles Tailwind v4 when it runs Tailwind's compiler over a stylesheet that imports `tailwindcss` or one of Tailwind's own sheets, such as `tailwindcss/utilities.css`. The compiler is the `@tailwindcss/vite` or `@tailwindcss/postcss` plugin in the build config, or the `@tailwindcss/cli` command in a script. Done when you can name all four.
2. Install the package with the project's package manager. Done when the install exits 0 and `package.json` lists `@elmeragroup/fuse`.
3. Choose the CSS mode. With Tailwind v4, use Fuse's Tailwind source; otherwise, the standalone stylesheet. Add the imports `/quick-start#install` shows for that mode. Done when the imports are in place and, with Tailwind, the `@source` path resolves from its stylesheet's folder to the installed package.
4. Choose the theme and density with the `fuse-theming` skill. Without it, read `/handbook/theming#three-axes` and `/handbook/density#per-document`. Done when you have one theme and one density for each document.
5. Write the document. For the Next App Router, write the scaffold from `/quick-start#page-scaffold` into the module that renders `<html>`. For another framework, read its own section first, `/handbook/theming#next-pages`, `/handbook/theming#tanstack-start`, `/handbook/theming#react-router` or `/handbook/theming#vite`, then `/handbook/theming#first-paint`, and put each piece `/quick-start#page-scaffold` lists where that section says. Done when the `<html>` start tag the app serves, before any JavaScript runs, carries the attributes `documentAttributes` returns for that theme and density, and one `ThemeProvider` with the same theme wraps the app.
6. Read `/quick-start#temporal`. If the app renders a date component, or will, import the polyfill in each runtime it names. Done when TypeScript and its `lib` setting meet the section, and every rendering runtime imports the polyfill or the app has no date component.
7. Render a Button as `/quick-start#using-a-component` shows, on a page the app serves. Done when the project type-checks, and the element with `data-slot="button"` has classes that a stylesheet the page links defines rules for, read from `curl` of a server-rendered page or from the browser's DOM in a client-rendered app.

## Rules

- Import each component by the import line in its page's `#usage` section, and copy no component source into the app.
- In a Tailwind build, a Fuse element whose classes have no rules means `@source` does not reach the package. Fix the path from step 3.
- Rename or delete a template's variables that share a Fuse role token's name, such as Vite's `--border` and `--accent`. A later `:root` rule beats a neutral theme.

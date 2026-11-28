---
name: fuse-setup
description: Fuse (`@elmeragroup/fuse`) setup in a React app. Use when adding Fuse to an app, choosing its Tailwind or standalone CSS, or when Fuse components render unstyled.
---

# Fuse setup

Every href below is a `read_doc` argument. Pass several in one call.

## Steps

1. Read the project and `/quick-start#install`. Name the project's framework, its package manager, the module that renders `<html>`, and whether the app's build compiles Tailwind v4, as `/quick-start#tailwind-v4-build` decides it. Done when you can name all four.
2. Install the package with the command `/quick-start#install` shows, package spec and any tag unchanged, run with the project's package manager. Done when the install exits 0 and the version `package.json` lists for `@elmeragroup/fuse` is the one `npm view` prints for that command's package spec.
3. Choose the CSS mode. With Tailwind v4, use Fuse's Tailwind source; otherwise, the standalone stylesheet. Add the imports `/quick-start#install` shows for that mode. Done when the imports are in place and, with Tailwind, the `@source` path resolves from its stylesheet's folder to the installed package.
4. Choose the theme and density. When the request or the project fixes the identity, brand, segment and density, use them. When any of them is open, choose them with the `fuse-theming` skill, or without it read `/handbook/theming#three-axes` and `/handbook/density#per-document`. Done when you have one theme and one density for each document.
5. Write the document. For the Next App Router, write the scaffold from `/quick-start#page-scaffold` into the module that renders `<html>`. For another framework, read its own section first, `/handbook/theming#next-pages`, `/handbook/theming#tanstack-start`, `/handbook/theming#react-router` or `/handbook/theming#vite`, then `/handbook/theming#first-paint`, and put each piece `/quick-start#page-scaffold` lists where that section says. Done when the `<html>` start tag the app serves, before any JavaScript runs, carries the attributes `documentAttributes` returns for that theme and density, and one `ThemeProvider` with the same theme wraps the app.
6. Read `/quick-start#temporal`. If the app renders a date component, or will, import the polyfill in each runtime it names. Done when TypeScript and its `lib` setting meet the section, and every rendering runtime imports the polyfill or the app has no date component.
7. Render a Button as `/quick-start#using-a-component` shows, on a page the app serves. Done when the project type-checks, and the element with `data-slot="button"` has classes that a stylesheet the page links defines rules for. On a server-rendered page, read the element and the stylesheet links from `curl` of the page. In a client-rendered app, read the element from the browser's DOM, or read the built output: a class the button's element carries has a rule in the stylesheet the built `index.html` links.

## Rules

- Import each component by the import line in its page's `#usage` section, and copy no component source into the app.
- When a Fuse element's classes have no rules, first rule out a page that links no stylesheet at all. In a Tailwind build whose page links one, `@source` does not reach the package. Fix the path from step 3.
- Rename or delete a template's variables that share a Fuse role token's name, as `/handbook/theming#vite` shows for Vite's template. A later `:root` rule beats a neutral theme.

---
name: fuse-setup
description: Fuse (`@elmeragroup/fuse`) setup in a React app. Use when adding Fuse to an app, choosing its Tailwind or standalone CSS, or when Fuse components render unstyled.
---

# Fuse setup

Every href below is a `read_doc` argument. Pass several in one call.

## Steps

1. Read the project and `/quick-start#install`. Name the project's framework, its package manager, the module that renders `<html>`, and whether the app's build compiles Tailwind v4, as `/quick-start#tailwind-v4-build` decides it. Done when you can name all four.
2. Install the package with the project's package manager, using the package spec `/quick-start#install` shows, tag included. Done when the install exits 0, the spec you installed is the one that section shows, and `package.json` lists `@elmeragroup/fuse`.
3. Choose the CSS mode. With Tailwind v4, use Fuse's Tailwind source; otherwise, the standalone stylesheet. Add the imports `/quick-start#install` shows for that mode. Done when the imports are in place and, with Tailwind, the `@source` path resolves from its stylesheet's folder to the installed package.
4. Choose the theme and density. When the request or the project fixes the identity, brand, segment and density, use them. When any of them is open, choose them with the `fuse-theming` skill, or without it read `/handbook/theming#three-axes` and `/handbook/density#per-document`. Done when you have one theme and one density for each document.
5. Write the document. For the Next App Router, write the scaffold from `/quick-start#page-scaffold` into the module that renders `<html>`. For another framework, read its own section first, `/handbook/theming#next-pages`, `/handbook/theming#tanstack-start`, `/handbook/theming#react-router` or `/handbook/theming#vite`, then `/handbook/theming#first-paint`, and put each piece `/quick-start#page-scaffold` lists where that section says. Keep the theme in one module that `documentAttributes` and `ThemeProvider` read. Done when the `<html>` start tag the app serves, before any JavaScript runs, carries the attributes `documentAttributes` returns for that theme and density, the color scheme bootstrap comes before the first module script in that HTML unless the app leaves color scheme support out, and one `ThemeProvider` that reads the same module wraps the app.
6. Read `/quick-start#temporal`. If the app renders a date component, or will, import the polyfill in each runtime it names. Done when TypeScript and its `lib` setting meet the section, and every rendering runtime imports the polyfill or the app has no date component.
7. Render a Button as `/quick-start#using-a-component` shows, on a page the app serves. Done when the project type-checks, and a stylesheet the page loads has a rule that sets the background of the element with `data-slot="button"` through one of its classes, and defines the role token that rule reads. On a server-rendered page, read the element and its stylesheets from `curl` of the page. In a client-rendered app, read them from the browser's DOM, or from the built output, following the entry and the page's chunks to the CSS they load.

## Rules

- Import each component by the import line in its page's `#usage` section, and copy no component source into the app.
- When a Fuse element's classes have no rules, first check that the page loads the stylesheet step 3 set up. In a Tailwind build that loads it, `@source` does not reach the package. Fix the path from step 3.
- Rename or delete a template's variables that share a Fuse role token's name, as `/handbook/theming#vite` shows for Vite's template.

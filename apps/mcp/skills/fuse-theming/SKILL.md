---
name: fuse-theming
description: Fuse (`@elmeragroup/fuse`) themes and density. Use when choosing a theme from a brand, segment or identity, setting a page's density, re-theming part of a page, or mapping an app's own tokens onto Fuse.
---

# Fuse theming

Every href below is a `read_doc` argument. Pass several in one call.

## Steps

Do the steps the request needs. Step 1 keeps the app's own tokens. Step 2 resolves a theme from a brand, a segment or an identity. Step 3 chooses or changes a document's density. Step 4 sets up a document or changes its theme, and its check also closes a density change. Step 5 re-themes part of a page, after step 2 when the request does not give the part's theme in full.

1. To keep the app's own tokens, read `/handbook/theming#own-tokens`. Done when the app sets every role token in the Tokens consumed section, such as `/components/button#tokens-consumed`, of each component it renders; a page without one reads none.
2. Read `/handbook/theming#three-axes`, `/handbook/brands-and-segments#brands` and `/handbook/brands-and-segments#pinned-brands`. Map the request onto the three axes; the brands table gives a brand's code. Ask about any axis the user and the project leave open. With nobody to ask, choose it yourself and say in your answer which choice you made. Done when you have one identity, one brand code and one segment whose slug `/handbook/brands-and-segments#the-twenty-four` lists.
3. Read `/handbook/density#per-document` and choose each document's density. When the app needs both densities, read `/handbook/density#route-groups` and `/handbook/density#pitfalls`. Done when each document has its density.
4. Read `/handbook/theming#document-theme`, `/handbook/theming#color-scheme`, `/handbook/theming#first-paint`, and the framework's section: `/handbook/theming#next-app-router`, `/handbook/theming#next-pages`, `/handbook/theming#tanstack-start`, `/handbook/theming#react-router` or `/handbook/theming#vite`. Keep the theme in one module that `documentAttributes` and `ThemeProvider` read. Done when each served document's `<html>` start tag, read from its built file or `curl` of a running server, carries what `documentAttributes` returns for its theme and density.
5. To re-theme part of a page, read `/handbook/theming#theme-scope`. Done when the part sits in a `ThemeScope` and the document keeps its theme.

## Rules

- A `ThemeScope` keeps the document's density, as `/handbook/density#per-document` says.
- Write the theme and density attributes through `documentAttributes`. Change a theme through the `theme` prop of `ThemeProvider` or `ThemeScope`.
- Fuse loads no font files. Text uses system fonts until the app loads the brand's and sets `--font-sans` and `--font-heading`. When the request is about typography or a brand's fonts, ask the user for the files.

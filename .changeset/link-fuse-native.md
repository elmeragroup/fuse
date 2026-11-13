---
"@elmeragroup/fuse": minor
---

`Link` is a permanent component at `@elmeragroup/fuse/link`, also in the root barrel, built on Base
UI's `useRender`. It renders an `<a data-slot="link">` and is underlined at rest
by default. It takes the sentence's font, size, weight and line height and stays inline, so a long
link wraps with its text. The underline's offset and thickness scale with the text, and the line is
never thinner than 1px.

The new `underline` prop sets the cue: `"always"` (the default) underlines at rest in a dimmed line,
the link's colour at 35% in a light scheme and 65% in a dark one, and draws it in the full colour
on hover; `"hover"` underlines only on hover; and `"none"` never underlines and fades the text
on hover. `variant` takes `default`, which inherits the text colour, `foreground`, `primary`, `brand`,
`muted` or `error`. `weight` and `truncate` stay. An SVG child marked `data-icon="inline-end"` or
`data-icon="inline-start"`, such as an external-link icon, is drawn one `em` square in the link's
colour, and keeps the link on one line. The entry exports the `linkVariants` recipe.

To route through an app's router, pass its link as `render`, such as
`<Link render={<NextLink href="/invoices" />}>`. React Router's `Link` works the same way. An
internal `href` on a bare `Link` is a full navigation.

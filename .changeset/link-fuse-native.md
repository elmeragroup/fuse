---
"@elmeragroup/fuse": minor
---

`Link` is a permanent component at `@elmeragroup/fuse/link`, also in the root barrel, built on Base
UI's `useRender` instead of React Aria. It renders an `<a data-slot="link">` and is underlined at rest
by default. It takes the sentence's font, size, weight and line height and stays inline, so a long
link wraps with its text. The underline's offset and thickness scale with the text, and the line is
never thinner than 1px.

The new `underline` prop sets the cue: `"always"` (the default) underlines at rest and thickens the
line on hover, `"hover"` underlines only on hover, and `"none"` never underlines and fades the text
on hover. `variant` takes `default`, which inherits the text colour, `foreground`, `primary`, `brand`,
`muted` or `error`. `weight` and `truncate` stay. An SVG child marked `data-icon="inline-end"` or
`data-icon="inline-start"`, such as an external-link icon, is drawn one `em` square in the link's
colour, and keeps the link on one line. The entry exports the `linkVariants` recipe.

To route through an app's router, pass its link as `render`, such as
`<Link render={<NextLink href="/invoices" />}>`. React Router's `Link` and React Aria's `Link` work
the same way. Rendering through React Aria's `Link` keeps the `UiProviders` routing.

Breaking: `@elmeragroup/fuse/react-aria/link` is removed. Import `Link` from `@elmeragroup/fuse/link`.
An internal `href` on a bare `Link` is now a full navigation; to keep client-side routing through
`UiProviders`, render through React Aria's `Link`: `<Link render={<AriaLink href="/x" />}>`. The
`leading` and `align` props are removed, along with the `secondary` and `inherit` variants: use
`foreground` for `secondary` and `default` for `inherit`. `isDisabled`, `onPress` and the other React
Aria props are gone, since a native anchor has no disabled state. The default weight is now the
surrounding text's, not `font-normal`.

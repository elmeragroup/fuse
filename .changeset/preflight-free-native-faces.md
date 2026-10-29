---
"@elmeragroup/fuse": patch
---

In a host without Tailwind's preflight, such as one on the standalone stylesheet, Fuse's own
elements no longer keep the browser's defaults. They now look as they do with preflight.

- The elements that carry a `data-slot` take every element rule of preflight, scoped to them,
  from base-layer rules. Every Fuse element sizes with `box-sizing: border-box`, as under
  preflight, so a part with a width plus padding or border is that width overall. A button rests on no fill, border or padding of the browser's own, in the font
  and text colour around it. A heading keeps no size, weight or margin of its own. A text field
  takes the font around it. A link takes the colour and decoration around it. A list shows no
  markers, margin or indent.
- The ghost and link `Button` variants, the Sidebar rows, actions and rail, `Toggle`, the
  Accordion and Collapsible triggers and a bare `Combobox.Trigger` no longer show the browser's grey
  button face, outset border or button font. An Accordion trigger no longer takes the size and
  margins of the `h3` around it. `Input` and `Textarea` no longer use the browser's control font.
- Pagination links, `Breadcrumb.Link`, `Item` rendered as a link, the Attachment link trigger and
  `Link` no longer show link blue or an underline, and `Breadcrumb.List`, `Pagination.Content`,
  `Sidebar.Menu` and `Sidebar.MenuSub` no longer show markers or the 40px list indent.
- `Table` outside a `Frame` collapses its borders, so its row dividers paint. `Field.Set` draws no
  fieldset frame. `Card.Description`, `Empty.Description`, `DescriptionList.Content` and `Code`
  keep no browser block margin. `Textarea` resizes only vertically. The PhoneNumberField country
  trigger takes the font around it. An `Item.Root` with `hidden` stays hidden.
- The reset sits in the base layer, so every utility, a `render` element's own classes and the
  host's own unlayered reset still win over it, except `hidden`, which preflight makes
  `display: none !important` so it beats a part's display class. Under preflight it changes
  nothing.

---
"@elmeragroup/fuse": patch
---

In a host without Tailwind's preflight, such as one on the standalone stylesheet, Fuse's own
buttons, links and lists no longer keep the browser's defaults. They now look as they do with
preflight.

- The elements that carry a `data-slot` take preflight's resets for buttons, links and lists from
  the stylesheet's base layer. A button rests on no fill, border or padding of the browser's own,
  in the font and text colour around it. A link takes the colour and decoration around it. A list
  shows no markers, margin or indent.
- The ghost and link `Button` variants, the Sidebar rows, actions and rail, `Toggle`, the
  Accordion and Collapsible triggers and a bare `Combobox.Trigger` no longer show the browser's grey
  button face, outset border or button font. Pagination links, `Breadcrumb.Link`, `Item` rendered
  as a link and the Attachment link trigger no longer show link blue or an underline, and
  `Breadcrumb.List`, `Pagination.Content`, `Sidebar.Menu` and `Sidebar.MenuSub` no longer show
  markers or the 40px list indent.
- The reset sits in the base layer, so every utility, a `render` element's own classes and the
  host's own reset still win over it. Under preflight it changes nothing.

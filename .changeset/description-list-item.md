---
"@elmeragroup/fuse": minor
---

`DescriptionList.Item` wraps one name-value group: a `<div>` around its terms and details that takes
attributes such as a `data-testid`. **Breaking:** every description list is now made of Items. Wrap
each term and its details in a `DescriptionList.Item`; HTML doesn't allow a list to mix Items with
bare terms and details, and the layouts no longer style bare ones.

Each inline Item now shares its own row between its term and details, whatever the other rows hold,
instead of every row sharing one details column capped at 60% of the list. The details sits at the end
of the term's line while the two fit, and a long term wraps beside it. A details too wide to sit
beside the term's longest word moves under the term, at the end of the row, so an email address or a
date stays on one line. Only a details wider than the row wraps, between words where it can. Override
inline cells with a `[:where([data-layout=inline]>*)>&]:` class, which replaces
`[:where([data-layout=inline])>&]:`.

A responsive list draws its rule above each Item but the first. A later details of one term now stays
in the details column from `sm` up, and details no longer take the browser's start margin in hosts
without a CSS reset.

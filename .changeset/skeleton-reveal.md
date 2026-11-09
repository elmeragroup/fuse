---
"@elmeragroup/fuse": minor
---

`SkeletonReveal` (`@elmeragroup/fuse/skeleton`) draws a loading skeleton from the real content
instead of hand-placed `Skeleton` shapes. Pass `data`, an optional `sample` and a render function,
or plain children with `loading`. While loading, the content renders unseen with the data on screen,
the last data shown or the sample, and the skeleton draws a bar over each line of its text and a
block over each control, avatar, badge or image, in exactly the content's space. `reveal` picks how
the content replaces the skeleton: `smart` (the default), `together` or `sequence`. The reveal eases
to the content's height when it differs from the skeleton's, except under reduced motion. The root
is `aria-busy` while loading and reads `label`, by default the locale dictionary's "Loading", to
screen readers. Form controls in the skeleton, and in content on its way out, are neither submitted
nor validated with their form, and Fuse overlays in them open nothing. Mark consumer markup with
`data-skeleton="block"` or `data-skeleton="ignore"` to draw it as one block or leave it out.
`Skeleton` is unchanged.

---
"@elmeragroup/fuse": minor
---

Add `AspectRatio` and `Attachment`.

- `AspectRatio`, from `@elmeragroup/fuse/aspect-ratio`, is a server component that keeps its
  child at one of seven ratios. `ratio` is required and takes `"1:1"`, `"4:3"`, `"3:4"`, `"3:2"`,
  `"2:3"`, `"16:9"` or `"9:16"`, and the type check rejects a number or any other string. A
  consumer `aspect-*` class, such as `aspect-[7/5]`, replaces the ratio. A direct `img` or `video`
  child is a block, so it fills the frame without growing it in a host without preflight.
- `Attachment`, from `@elmeragroup/fuse/attachment`, shows a file or an image with its upload
  state and actions. `Root` takes `state` (`idle`, `uploading`, `processing`, `error` or `done`),
  `size` (`default`, `sm` or `xs`) and `orientation` (`horizontal` or `vertical`). `Media` frames
  an icon or a square image, and an `AspectRatio` part inside it sets another shape. `Title`
  shows a moving highlight while the file uploads or processes and stays still under reduced
  motion. `Description` carries the readable status. `Action` is an icon `Button` that needs an
  `aria-label`. It is `secondary` on a vertical tile and `ghost` in a row. `Trigger` turns the
  whole attachment into one button or link under its actions. `Group` is a list that scrolls
  sideways, snaps to each attachment and fades an edge while more lies past it. Picking files and
  uploading them stay in your app.

`fuse.css` gains a `shimmer` utility with an `--animate-shimmer` theme variable, which the
reduced-motion rules turn off.

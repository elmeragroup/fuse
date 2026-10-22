import { cn } from "../../styles/cn";
import { dataStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * Runtime-free recipe for the Switch's track and thumb, with a size axis; default `default`. Not
 * exported from `@elmeragroup/fuse/switch`; the workspace-only recipe catalog re-exports it for
 * the Figma component sync.
 *
 * - `root` is the track, 32px by 18.4px at `default` and 24px by 14px at `sm`. Its `max-w-*`
 *   caps a wider `className` width at the size's, as Checkbox's `max-w-4` does.
 * - `thumb` is the 16px or 12px dot. It sits at the track's start while unchecked, drawn at 75%,
 *   and at its end while checked.
 * - `control` is what the Switch control adds to the track: the `peer` marker for a sibling's
 *   `peer-*` styles, the native outline reset, a 24px hit area around the track drawn by its
 *   `after:` pseudo-element, the focus ring and the state face.
 *
 * The checked face reads `data-checked` and `data-unchecked` on each part, so any element that
 * carries those attributes draws the same switch from `root` and `thumb`. The data table filter's
 * toggle row draws one this way, as a picture of its own checked state, and leaves out `control`.
 * Runtime-free, so that row borrows the look without Switch's client graph.
 */
export const switchVariants = tv({
  slots: {
    // The unchecked track is an outline: its edge and thumb take `muted-foreground`, held to 3:1
    // on every surface by the matrix rule in `contrast-matrix.test.ts`, and the surface shows
    // through. The checked track is the `primary` fill with a `background` thumb, so on versus
    // off reads as outline versus fill in every palette, as on Checkbox and Radio.
    root: "shadow-xs relative inline-flex shrink-0 items-center rounded-full border border-muted-foreground transition-colors data-checked:border-primary data-checked:bg-primary",
    thumb:
      "pointer-events-none block rounded-full bg-muted-foreground ring-0 transition-transform data-checked:translate-x-[calc(100%-2px)] data-checked:bg-background data-unchecked:translate-x-0 data-unchecked:scale-75",
    control: cn(
      // The track is a <span>, so the state face keys off Base UI's `data-disabled` and
      // `data-invalid` attributes, plus a consumer's `aria-invalid`.
      // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
      "peer outline-none after:absolute after:-inset-x-3 after:-inset-y-3 after:content-['']",
      selfFocusRingClass,
      dataStateFaceClass
    ),
  },
  variants: {
    size: {
      default: { root: "h-[18.4px] w-[32px] max-w-[32px]", thumb: "size-4" },
      sm: { root: "h-[14px] w-[24px] max-w-[24px]", thumb: "size-3" },
    },
  },
  defaultVariants: {
    size: "default",
  },
});

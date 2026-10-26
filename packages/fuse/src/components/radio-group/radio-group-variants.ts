import { cn } from "../../styles/cn";
import { controlSize } from "../../styles/control-size";
import { dataStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * Runtime-free recipe. Size axis for `RadioIconButton`; default `icon`. Not exported from
 * `@elmeragroup/fuse/radio-group`; the workspace-only recipe catalog re-exports it for the Figma
 * component sync.
 *
 * Each size is the control-size recipe's `square`, like Button's icon sizes. `icon-xxs` and
 * `icon-xs` share the `xs` square and differ only by glyph size, which stays local. Svg sizes apply only to
 * `svg:not([class*='size-'])`. The base carries the shared self focus ring. The radio root is a
 * <span>, which never matches `:disabled`, so the state face keys off Base UI's `data-disabled`
 * and `data-invalid` attributes, plus a consumer's `aria-invalid`. Hover and press sit behind the
 * `enabled-*` gate, so a disabled button neither repaints nor scales under the pointer.
 */
export const radioIconButtonVariants = tv({
  base: cn(
    // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
    "ease-out inline-flex shrink-0 items-center justify-center rounded-lg border border-input bg-card text-foreground transition-[color,background-color,box-shadow,scale] duration-150 outline-none data-checked:border-primary data-checked:bg-muted enabled-hover:bg-muted enabled-active:scale-[0.96]",
    selfFocusRingClass,
    dataStateFaceClass
  ),
  variants: {
    size: {
      "icon-xxs": controlSize({ size: "xs", fit: "square", class: "[&_svg:not([class*='size-'])]:size-3" }),
      "icon-xs": controlSize({
        size: "xs",
        fit: "square",
        class: "[&_svg:not([class*='size-'])]:size-3.5",
      }),
      "icon-sm": controlSize({ size: "sm", fit: "square", class: "[&_svg:not([class*='size-'])]:size-4" }),
      icon: controlSize({ size: "md", fit: "square", class: "[&_svg:not([class*='size-'])]:size-4" }),
      "icon-lg": controlSize({ size: "lg", fit: "square", class: "[&_svg:not([class*='size-'])]:size-5" }),
    },
  },
  defaultVariants: {
    size: "icon",
  },
});

/**
 * Runtime-free recipe for `RadioGroupItem`'s circle, its indicator and the dot inside. Not
 * exported from `@elmeragroup/fuse/radio-group`; the workspace-only recipe catalog re-exports
 * it for the Figma component sync.
 *
 * - `root` is the 16px circle. It carries the `peer` marker for a sibling's `peer-*` styles, the
 *   native outline reset and a hit area of 12px beside and 8px above and below the circle, drawn
 *   by its `after:` pseudo-element.
 * - `indicator` is a 16px box that centers the dot. Base UI mounts it only while checked.
 * - `dot` is the 8px `primary-foreground` dot, centered on the circle.
 */
export const radioVariants = tv({
  slots: {
    root: cn(
      // The root is a <span>, which never matches `:disabled`, so the state face keys off
      // Base UI's `data-disabled` and `data-invalid` attributes, plus a consumer's
      // `aria-invalid`. A checked invalid radio keeps its primary border beside the ring.
      // The unchecked edge is the circle's only boundary, so it takes `muted-foreground`, as
      // Checkbox does.
      // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
      "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-muted-foreground transition-[color,box-shadow] outline-none after:absolute after:-inset-x-3 after:-inset-y-2 after:content-[''] data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
      selfFocusRingClass,
      dataStateFaceClass,
      "aria-invalid:aria-checked:border-primary data-invalid:aria-checked:border-primary"
    ),
    indicator: "flex size-4 items-center justify-center",
    dot: "absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground",
  },
});

/**
 * Runtime-free recipe for `Radio`, the labelled row. Not exported from
 * `@elmeragroup/fuse/radio-group`; the workspace-only recipe catalog re-exports it for the Figma
 * component sync.
 *
 * - `root` is the row's `Field.Item`.
 * - `label` is the `Field.Label` around the circle and the content, the whole row's click target.
 * - `content` keeps the label's flex row for its children, so text and a badge stay 8px apart and
 *   centred. It dims from the circle's `data-disabled` through `peer`, so the circle, which dims
 *   itself, is not dimmed twice.
 */
export const radioRowVariants = tv({
  slots: {
    root: "flex",
    label: "text-sm flex cursor-pointer items-center gap-2 has-disabled:cursor-not-allowed",
    content: "flex items-center gap-2 peer-data-disabled:opacity-50",
  },
});

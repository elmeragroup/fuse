import { cn } from "../../styles/cn";
import {
  itemDefaultShellClass,
  itemShellClass,
  itemSmShellClass,
  itemXsShellClass,
} from "../../styles/inner-corner/item";
import { nativeStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * PUBLIC row recipe, shipped from `@elmeragroup/fuse/item`. A link row takes the hover fill
 * behind the `enabled-hover` gate. The state face takes the `native` target with its `aria`
 * arms: a button row reads `:disabled`, and a link row, which takes no `disabled`, reads
 * `aria-disabled="true"`.
 */
export const itemVariants = tv({
  base: cn(
    itemShellClass,
    "group/item text-sm flex w-full flex-wrap items-center transition-colors duration-100 [a]:transition-colors [a]:enabled-hover:bg-muted",
    selfFocusRingClass,
    nativeStateFaceClass
  ),
  variants: {
    variant: {
      default: "border-transparent",
      // An outline row is a bordered content box, so it rests on the `panel` fill, as the default
      // Alert and Frame.Panel do: white in every light theme, also on a tinted branded page, and
      // the page in dark. It states the fill as `--surface`, as every container fill does (see
      // `TOKEN_NAMES`). A link row's hover paints `muted` over it, so its text takes `foreground`,
      // the gated pair on `muted`, and it states `muted` as its surface. The hover arm sets only `--item-foreground`, which one plain
      // text utility reads, so a `text-*` in `className` replaces that utility at rest and on hover.
      outline:
        "border-border bg-panel text-(color:--item-foreground) [--item-foreground:--theme(--color-panel-foreground)] [--surface-muted-foreground:--theme(--color-muted-foreground)] [--surface:--theme(--color-panel)] [a]:enabled-hover:[--item-foreground:--theme(--color-foreground)] [a]:enabled-hover:[--surface-muted-foreground:--theme(--color-muted-foreground)] [a]:enabled-hover:[--surface:--theme(--color-muted)]",
      muted: "border-transparent bg-muted/50",
    },
    size: {
      default: [itemDefaultShellClass, "gap-(--surface-gap-md)"],
      sm: [itemSmShellClass, "gap-(--surface-gap-sm)"],
      xs: [itemXsShellClass, "gap-(--surface-gap-sm)"],
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

/**
 * Module-private slot recipe. Not exported from the public entry, since there is no proven
 * recipe-borrowing use; the workspace-only recipe catalog re-exports it for the Figma component
 * sync.
 *
 * `variant` is the status axis only. Item supplies `variant="outline"` / `size="sm"`
 * underneath; this recipe is not a control size. The `media` and `title` slots add to Item.Media's
 * and Item.Title's own classes.
 */
import { tv } from "../../styles/tv";

export const alertVariants = tv({
  slots: {
    base: "relative",
    // Beside a description Item.Media is one title line tall and centres the glyph on it. Item sizes
    // that line for Item.Title's fixed `text-sm`; the alert title reads `--label-text`, so the media
    // line does too. It replaces Item.Media's own `item-described:` value of the same property.
    media: "item-described:[--item-media-line:calc(var(--label-text)*var(--leading-snug))]",
    icon: "block size-5 shrink-0 text-foreground",
    // An alert's title takes the label text, `--label-text`, so it follows document density as
    // SelectionItem's rows do: 14px dense and 16px comfortable. It keeps Item.Title's `font-medium`
    // and `leading-snug`, written as the size's `/snug` modifier because tailwind-merge drops a line
    // height that comes before a font size.
    title: "text-(length:--label-text)/snug",
    // The body takes the label text, `--label-text`, at `leading-normal`, as SelectionItem's
    // description does: 14px dense and 16px comfortable. The size carries the line height as its
    // `/normal` modifier, because tailwind-merge drops a line height that comes before a font size.
    // `text-inherit` replaces Item's `text-muted-foreground`, so the body takes the variant's
    // text colour from `base`, as the title does. Zeroes its blocks' own block margins and puts
    // 8px between consecutive blocks, twice the title's 4px gap; the selectors live in fuse.css.
    description: "text-(length:--label-text)/normal text-inherit rich-text-block:my-0 rich-text-gap:mt-2",
    button: "",
  },
  variants: {
    variant: {
      default: {
        // No `base`: the outline Item row underneath already paints the `panel` pair and states
        // it as `--surface`, white in every light theme and the page in dark, so the Alert reads
        // apart from a branded light page's tint and matches a Card or Frame.Panel around it.
        // The icon sits on the panel in `panel-foreground`, as the title and body do.
        icon: "text-panel-foreground",
        // Replaces Button's `enabled-hover:bg-primary/80`, which tailwind-merge keeps beside a
        // plain `bg-*` because the modifier differs, and which puts `text-foreground` on a
        // primary fill. It rests transparent on the Alert's panel in `panel-foreground`, as the
        // outline Button does on its surface, and its hover paints `muted` in `foreground`. Both
        // are gated text-grade pairs. The opaque hover states `muted` as its surface.
        button:
          "bg-transparent text-panel-foreground enabled-hover:bg-muted enabled-hover:text-foreground enabled-hover:[--surface-muted-foreground:--theme(--color-muted-foreground)] enabled-hover:[--surface:--theme(--color-muted)]",
      },
      destructive: {
        // `error` text on the 5% `error` tint over the page, card or card-soft is a gated pair
        // (contrast-matrix.test.ts), for the title and the body alike.
        // A translucent tint keeps the surface beneath it, so it drops the outline Item's `panel`.
        base: "border-error bg-error/5 text-error [--surface-muted-foreground:inherit] [--surface:inherit]",
        icon: "text-error",
        // oxlint-disable-next-line fuse/state-face -- the alert action has no disabled state; this only overrides its Button's fill
        button: "bg-error text-error-foreground hover:bg-error/90",
      },
      warning: {
        // The flush focus ring takes the soft foreground, held to 4.5:1 on this fill, where
        // the neutral grey falls under 3:1 in dark. The soft fill is opaque, so it is the surface,
        // and its soft foreground is the surface's muted text, which a chart's chips read.
        base: "border-warning bg-warning-soft text-warning-soft-foreground [--ring:var(--warning-soft-foreground)] [--surface-muted-foreground:--theme(--color-warning-soft-foreground)] [--surface:--theme(--color-warning-soft)]",
        icon: "text-warning",
        // oxlint-disable-next-line fuse/state-face -- the alert action has no disabled state; this only overrides its Button's fill
        button: "bg-warning text-warning-foreground hover:bg-warning/90",
      },
      success: {
        // `foreground` on the 5% `success` tint is gated beside the destructive pair.
        base: "border-success bg-success/5 text-foreground [--surface-muted-foreground:inherit] [--surface:inherit]",
        icon: "text-success",
        // oxlint-disable-next-line fuse/state-face -- the alert action has no disabled state; this only overrides its Button's fill
        button: "bg-success text-success-foreground hover:bg-success/90",
      },
      info: {
        // The flush focus ring takes the soft foreground, as on warning: the neutral grey
        // falls under 3:1 on the info-soft fill in dark.
        base: "border-info bg-info-soft text-info-soft-foreground [--ring:var(--info-soft-foreground)] [--surface-muted-foreground:--theme(--color-info-soft-foreground)] [--surface:--theme(--color-info-soft)]",
        icon: "text-info",
        // oxlint-disable-next-line fuse/state-face -- the alert action has no disabled state; this only overrides its Button's fill
        button: "bg-info text-info-foreground hover:bg-info/90",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

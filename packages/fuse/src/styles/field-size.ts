import type { VariantProps } from "tailwind-variants";

import { cn } from "./cn";
import { tv } from "./tv";

/**
 * Field size: the `size` axis of every text-entry field box, `"default"` (the md control size)
 * or `"sm"` (the sm control size), carried to the parts inside the box through CSS variables.
 *
 * The `box` slot WRITES the size on the field box: `--field-h` (box height), `--field-px` (inline
 * inset), `--field-gap`, `--field-inner` (the square of a button inside the box), and the type
 * pair `--field-text` / `--field-leading`. Every other slot READS them, on the box itself and on
 * the parts inside it (the inner input, segment rows, addons, inner buttons, chips), so a part
 * follows the box it sits in without taking a `size` of its own.
 *
 * Every box writes at every size. A `"default"` box resets each variable to `initial`, the
 * guaranteed-invalid value, so a default box nested in an sm box (an editor or a picker search
 * inside an sm field's popup, a field in an addon) never inherits the outer size. Each read
 * falls back to the md metric, so a reset variable, or a part rendered outside any box, reads
 * md. The md metrics are spelled once, in those fallbacks, rather than once more as default
 * writes, and the sm metrics once, in the sm writes.
 *
 * The sm type is the fixed 14px / 20px of Tailwind's `text-sm`, as Select's sm trigger and the
 * sm control size (`control-size.ts`) have it; it does not follow density. The md type is the
 * density pair `--control-text` / `--control-leading`. Both leadings are lengths: Tailwind's
 * `--text-sm--line-height` is a ratio, so the sm leading multiplies it by the sm text into 20px,
 * which a floored 16px font keeps, as the md leading does.
 *
 * Each read is a typed arbitrary-value height, inline-padding, font-size or line-height utility,
 * so tailwind-merge groups it with the consumer's `h-12`, `px-3`, `text-lg` or
 * `leading-5` and `cn` keeps only the consumer's class (see `control-size-md.ts` for why the
 * removal, not the cascade, is what lets the consumer win).
 *
 * `entryType` is the text-entry type: the field text with a 16px font-size floor under the
 * `entry-floor` variant, at both sizes. `fuse.css` declares that variant as a coarse pointer or
 * iOS-family WebKit, and says which devices each arm catches. iOS Safari zooms the page into a
 * focused editable field whose text is under 16px and never zooms back out, and both dense
 * `--control-text` and the sm text are 14px. WebKit compares against a fixed 16px, not the root
 * size, so the floor is `16px`: a `1rem` floor would shrink under a host `html { font-size: 14px }`.
 * `max()` leaves comfortable 18px as it is. Only the font size moves: the leading and the box
 * height stay, and the taller glyphs still fit. Non-entry text that binds `type`, such as an
 * InputGroup addon, keeps 14px, because focusing it does not zoom.
 *
 * The floor is a private `--entry-text` that only `entry-floor` declares, on each element that
 * reads it, so an element reads its own value. The one font-size class reads it and falls back to
 * the field text. A consumer's font-size class replaces that class through tailwind-merge, so the
 * consumer's size applies on every pointer and the inert `--entry-text` is left behind. A
 * variant-prefixed floor class would instead survive the merge and shrink a larger consumer size,
 * such as the 18px TextField card input, to 16px. `ComboboxChipsInput` declares its own floor over
 * the chips box's inherited size.
 *
 * `field-size.browser.test.tsx` measures every field box at both sizes and densities against
 * `DENSITY_METRICS`; a new field box joins that matrix.
 */
export const fieldSize = tv({
  slots: {
    box: "",
    height: "h-[var(--field-h,var(--control-h-md))]",
    minHeight: "min-h-[var(--field-h,var(--control-h-md))]",
    inset: "px-[var(--field-px,var(--control-px-md))]",
    gap: "gap-[var(--field-gap,var(--control-gap-md))]",
    type: "text-[length:var(--field-text,var(--control-text))]",
    entryType:
      "text-[length:var(--entry-text,var(--field-text,var(--control-text)))] entry-floor:[--entry-text:max(16px,var(--field-text,var(--control-text)))]",
    inner: "size-[var(--field-inner,var(--control-h-sm))]",
  },
  variants: {
    size: {
      default: {
        box: "[--field-gap:initial] [--field-h:initial] [--field-inner:initial] [--field-leading:initial] [--field-px:initial] [--field-text:initial]",
      },
      // The box height is floored at 26px, a 24px target plus the box's two 1px borders, so the
      // parts inside it (steppers, inner buttons, chips) keep the 24px target size under a host
      // root below 16px; dense `--control-h-sm` is 24px at a 12px root. The inner square is the xs
      // control height, floored at 24px as the xs control size floors it.
      sm: {
        box: "[--field-gap:var(--control-gap-sm)] [--field-h:max(var(--control-h-sm),26px)] [--field-inner:max(var(--control-h-xs),24px)] [--field-leading:calc(var(--text-sm)*var(--text-sm--line-height))] [--field-px:var(--control-px-sm)] [--field-text:var(--text-sm)]",
      },
    },
  },
  // The field leading, shared by both type slots so it has one literal.
  compoundSlots: [
    { slots: ["type", "entryType"], class: "leading-[var(--field-leading,var(--control-leading))]" },
  ],
  defaultVariants: {
    size: "default",
  },
});

/** The field size a text-entry field box takes, from the recipe's `size` axis. */
export type FieldSize = NonNullable<VariantProps<typeof fieldSize>["size"]>;

/**
 * The read slots, resolved once at module scope as `controlMd` is. The reads do not depend on
 * the size; only `box` writes it.
 */
export const fieldReads = fieldSize();

/** The inner entry's inline inset and text-entry type, the pair every entry row reads. */
export const fieldEntryClass = cn(fieldReads.inset(), fieldReads.entryType());

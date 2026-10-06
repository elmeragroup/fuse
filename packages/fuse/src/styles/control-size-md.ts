import { tv } from "tailwind-variants";

import { cn } from "./cn";

/**
 * The md row of the control size (see `control-size.ts`), resolved once at module scope for
 * the controls that have no size axis: Tabs triggers, the Combobox chips box and the
 * text-entry boxes (Input, Textarea, the pickers, DateField and NumberField).
 * `controlMetrics` reads its md row from here, so each md literal has one owner.
 *
 * It sits in its own file, beside `control-size.ts`, because the docs token extraction
 * lists every `--control-*` variable a component's reachable sources spell. A consumer
 * that imports only this file lists no xs, sm or lg variables. The extraction is
 * file-granular, so it still lists every md part here, including ones the consumer does
 * not bind. Each slot is one metric family, so a consumer takes the parts it binds and
 * keeps its own geometry for the rest.
 *
 * The type pair is spelled as the typed variable utilities `text-(length:--control-text)`
 * and `leading-(--control-leading)`, not as the arbitrary properties `[font-size:…]` and
 * `[line-height:…]`. tailwind-merge groups the typed forms with `text-*` and `leading-*`,
 * so a consumer's `text-sm` or `leading-5` in `className` removes them through `cn`, and
 * only the consumer class reaches the element. That removal is the whole mechanism: Tailwind
 * 4.3.3 orders these rules by property and emits `.text-(length:--control-text)` after
 * `.text-sm`, so a recipe class left beside the consumer's would still win the cascade. An
 * arbitrary property never reaches the merge, because tailwind-merge puts it in no
 * font-size or line-height group, so `cn` kept both. The `length:` hint is required,
 * because a bare `text-(--var)` could also be a colour.
 *
 * `entryType` is the text-entry variant of `type`, with a font-size floor under the
 * `entry-floor` variant (see `controlMdInsetTypeClass`). Its one font-size class is a typed
 * arbitrary value, so tailwind-merge groups it with `text-*` the same way.
 */
export const controlMd = tv({
  slots: {
    height: "h-(--control-h-md)",
    minHeight: "min-h-(--control-h-md)",
    minWidth: "min-w-(--control-h-md)",
    square: "size-(--control-h-md)",
    gap: "gap-(--control-gap-md)",
    inset: "px-(--control-px-md)",
    iconInset: "px-(--control-px-icon-md)",
    iconEdge:
      "has-data-[icon=inline-end]:pr-(--control-px-icon-md) has-data-[icon=inline-start]:pl-(--control-px-icon-md)",
    type: "text-(length:--control-text)",
    entryType:
      "text-[length:var(--entry-text,var(--control-text))] entry-floor:[--entry-text:max(16px,var(--control-text))]",
  },
  // The density leading, shared by both type slots so it has one literal.
  compoundSlots: [{ slots: ["type", "entryType"], class: "leading-(--control-leading)" }],
})();

/**
 * The md inline inset and the density-owned type pair, the one pairing every text-entry box
 * uses: the field-box recipe, the RAC input, the picker and date-field inputs, and
 * NumberField's input. Each box sets its own height, so the pair leaves height out.
 *
 * Under the `entry-floor` variant the font size gets a 16px floor. `fuse.css` declares that
 * variant as a coarse pointer or iOS-family WebKit, and says which devices each arm catches.
 * iOS Safari zooms the page into a focused editable field whose text is under 16px and never
 * zooms back out, and dense `--control-text` is 14px. WebKit compares against a fixed 16px,
 * not the root size, so the floor is `16px`: a `1rem` floor would shrink under a host
 * `html { font-size: 14px }`.
 * `max()` leaves comfortable 18px as it is. Only the font size moves: the dense 20px leading
 * and the box height stay, and the taller glyphs still fit.
 * Non-entry controls that bind `controlMd.type()`, such as Tabs triggers, keep 14px, because
 * focusing them does not zoom.
 *
 * The floor is a private `--entry-text` that only `entry-floor` declares, on each box that
 * reads it, so a box reads its own value. The one font-size class reads it and falls back to
 * `--control-text`. A consumer's font-size class replaces that class through tailwind-merge, as
 * it replaces `controlMd.type()`, so the consumer's size applies on every pointer and the inert
 * `--entry-text` is left behind. A variant-prefixed floor class would instead survive the merge
 * and shrink a larger consumer size, such as the 18px TextField card input, to 16px.
 * `ComboboxChipsInput` declares its own floor over the chips box's inherited size.
 */
export const controlMdInsetTypeClass = cn(controlMd.inset(), controlMd.entryType());

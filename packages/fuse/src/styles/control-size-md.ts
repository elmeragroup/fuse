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
    type: "[font-size:var(--control-text)] [line-height:var(--control-leading)]",
  },
})();

/**
 * The md inline inset and the density-owned type pair, the one pairing every text-entry box
 * uses: the field-box recipe, the RAC input, the picker and date-field inputs, and
 * NumberField's input. Each box sets its own height, so the pair leaves height out.
 */
export const controlMdInsetTypeClass = cn(controlMd.inset(), controlMd.type());

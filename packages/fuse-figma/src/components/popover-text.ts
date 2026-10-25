/**
 * The docs Basic demo's Popover text, which `popover-kit.ts` draws and `popover-cell.ts` renders. It
 * imports nothing, so the compare page's browser bundle can take it without the kit's builder.
 */

/** The popup's title, the default of its `Title` property: the docs Basic demo's. */
export const POPOVER_TITLE_TEXT = "Dimensions";

/** The popup's description, the default of its `Description` property: the docs Basic demo's. */
export const POPOVER_DESCRIPTION_TEXT = "Set the dimensions for the layer.";

/** The labels of the docs Basic demo's Fields, in its order. */
export const POPOVER_FIELD_LABELS = ["Width", "Height"] as const;

/** The trigger's label, the docs Basic demo's. */
export const POPOVER_TRIGGER_TEXT = "Details";

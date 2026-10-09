import { cn } from "./cn";

/**
 * The label type pair, `--label-text` and `--label-leading`: 14/20px dense and 16/24px
 * comfortable. The words that describe a control read it: a field's label, title, description and
 * error, and a label-variant legend. It is spelled as the typed variable utilities, so
 * tailwind-merge groups it with `text-*` and `leading-*` and a consumer's `text-sm` replaces it.
 */
export const labelTypeClass = cn("text-(length:--label-text) leading-(--label-leading)");

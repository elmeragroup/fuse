/**
 * Key/Value text-overflow class. Package-private — not on the
 * `@elmeragroup/ui/table` facade.
 */
export function verticalTableCellText(text: "default" | "truncate"): string {
  return text === "truncate" ? "truncate" : "whitespace-normal";
}

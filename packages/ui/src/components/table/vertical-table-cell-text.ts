/**
 * Key/Value text-overflow class (table.md §3). Package-private — not on the
 * `@elmeragroup/ui/table` facade.
 */
export function verticalTableCellText(text: "default" | "truncate"): string {
  return text === "truncate" ? "truncate" : "whitespace-normal";
}

/**
 * The Key and Value text-overflow class. It is package-private: the `@elmeragroup/fuse/table`
 * entry does not export it.
 */
export function verticalTableCellText(text: "default" | "truncate"): string {
  return text === "truncate" ? "truncate" : "whitespace-normal";
}

/**
 * One item of a list's `items`: an entry of a flat array, or an item of a group when each entry
 * carries its own `items`. Base UI's Autocomplete Root reads groups first the same way, through
 * its grouped overload. Fuse keeps one signature per component, since the API reference describes
 * one props contract.
 *
 * @template Items - The `items` array, flat or of groups.
 */
export type ListItemOf<Items extends readonly unknown[]> = Items extends readonly {
  readonly items: readonly (infer Item)[];
}[]
  ? Item
  : Items[number];

/**
 * The array a list's `items` or `filteredItems` takes: flat, or of groups whose items are `Item`.
 * A group keeps its own keys through `Items[number]`, or an inline group literal's `value` would
 * fail the excess property check.
 *
 * @template Items - The array given, whose groups keep their own keys.
 * @template Item - One item of the list.
 */
export type ListItems<Items extends readonly unknown[], Item> =
  | readonly Item[]
  | readonly (Items[number] & { readonly items: readonly Item[] })[];

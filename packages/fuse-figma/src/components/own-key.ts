/**
 * Whether a value names one of a table's own keys, such as a cell's `size` among a recipe's
 * `variants.size`.
 *
 * @template Table - The table's type.
 * @param table - The table whose own keys count.
 * @param value - The value, such as a cell's axis value.
 * @returns True when the value is defined and is one of the table's own keys.
 */
export function ownKey<Table extends object>(
  table: Table,
  value: string | undefined
): value is Extract<keyof Table, string> {
  return value !== undefined && Object.hasOwn(table, value);
}

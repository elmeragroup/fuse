/** Reading a Flight payload's rows, for fixtures that check what the server sent. */

/** One client reference a payload sends: the module and the export the client loads. */
export type FlightClientReference = { readonly module: string; readonly name: string };

/**
 * Every client reference in a payload, from its `I[...]` rows. A development payload sends the
 * module id as a separate string row and points at it with `"$<row>"`, so those are resolved.
 *
 * @param payload - The Flight payload text.
 * @returns The references in payload order.
 */
export function flightClientReferences(payload: string): FlightClientReference[] {
  const rows = new Map<string, string>();
  for (const line of payload.split("\n")) {
    const match = /^([0-9a-f]+):(.*)$/u.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      rows.set(match[1], match[2]);
    }
  }
  const references: FlightClientReference[] = [];
  for (const body of rows.values()) {
    if (!body.startsWith("I[")) continue;
    const parsed: unknown = JSON.parse(body.slice(1));
    if (!Array.isArray(parsed)) continue;
    const entries: readonly unknown[] = parsed;
    const [id, , name] = entries;
    const module: unknown = String(id).startsWith("$")
      ? JSON.parse(rows.get(String(id).slice(1)) ?? '""')
      : id;
    references.push({ module: String(module), name: String(name) });
  }
  return references;
}

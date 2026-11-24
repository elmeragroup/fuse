/** Reading a Flight payload's rows, for fixtures that check what the server sent. */

/** One client reference a payload sends: the module and the export the client loads. */
export type FlightClientReference = { readonly module: string; readonly name: string };

/**
 * Every client reference in a payload, from its `I[...]` rows. A development payload can send the
 * module id or the export name as a separate string row and point at it with `"$<row>"`, so those
 * are resolved.
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
  // A repeated string, such as an export name two references share, also moves to its own row.
  const resolved = (value: string): string =>
    value.startsWith("$") ? String(JSON.parse(rows.get(value.slice(1)) ?? '""')) : value;
  const references: FlightClientReference[] = [];
  for (const body of rows.values()) {
    if (!body.startsWith("I[")) continue;
    const parsed: unknown = JSON.parse(body.slice(1));
    if (!Array.isArray(parsed)) continue;
    const entries: readonly unknown[] = parsed;
    const [id, , name] = entries;
    references.push({ module: resolved(String(id)), name: resolved(String(name)) });
  }
  return references;
}

/**
 * The Flight payload a Next page inlines in its HTML, joined from its `self.__next_f.push([1, …])`
 * strings in document order. A row can span two pushes, so the strings join before any row is read.
 *
 * @param html - The page's server HTML.
 * @returns The payload text.
 */
export function inlinedFlightPayload(html: string): string {
  const chunks: string[] = [];
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\[\s\S])*")\]\)/gu)) {
    const literal = match[1];
    if (literal !== undefined) chunks.push(String(JSON.parse(literal)));
  }
  return chunks.join("");
}

/** A value in a Flight model row, which is JSON. */
export type FlightJson = string | number | boolean | null | readonly FlightJson[] | FlightObject;

export type FlightObject = { readonly [key: string]: FlightJson };

/** The JSON models of a Flight payload's model rows (`<hex id>:[…]` or `<hex id>:{…}`). */
export function flightModels(payload: string): FlightJson[] {
  return payload.split("\n").flatMap((line) => {
    const [, body] = /^[0-9a-f]+:(.*)$/u.exec(line) ?? [];
    // SAFETY: Flight model rows are the I/O boundary. The body starts with `[` or `{`, and
    // JSON.parse yields only JSON values, so the result is a FlightJson array or object.
    return body !== undefined && (body.startsWith("[") || body.startsWith("{"))
      ? [JSON.parse(body) as FlightJson]
      : [];
  });
}

function isFlightArray(value: FlightJson): value is readonly FlightJson[] {
  return Array.isArray(value);
}

function isFlightObject(value: FlightJson | undefined): value is FlightObject {
  return value instanceof Object && !isFlightArray(value);
}

/**
 * Every Flight element at any depth of `value`. An element is `["$", type, key, props, …]`;
 * dev builds add fields after the props.
 */
export function flightElements(value: FlightJson): { type: FlightJson | undefined; props: FlightObject }[] {
  if (!(value instanceof Object)) {
    return [];
  }
  const nested = Object.values(value).flatMap(flightElements);
  if (isFlightArray(value) && value[0] === "$") {
    const props = value[3];
    if (isFlightObject(props)) {
      return [{ type: value[1], props }, ...nested];
    }
  }
  return nested;
}

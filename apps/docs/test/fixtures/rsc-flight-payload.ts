/** Reading a Flight payload's rows, for fixtures that check what the server sent. */

/** One client reference a payload sends: the module and the export the client loads. */
export type FlightClientReference = { readonly module: string; readonly name: string };

/** One row of a Flight payload: its hex id, its tag letter (empty for a model row) and its body. */
export type FlightRow = { readonly id: string; readonly tag: string; readonly body: string };

/**
 * The rows of a Flight payload, in order. A row is `<hex id>:<body>` ending in a line feed, except
 * a text row, `<hex id>:T<hex byte length>,<text>`, which ends after that many UTF-8 bytes with no
 * line feed, so the next row can follow on the same line. The body keeps its tag letter, such as
 * `I[…]` for a client reference.
 *
 * @param payload - The Flight payload text.
 * @returns The rows in payload order.
 */
export function flightRows(payload: string): FlightRow[] {
  const bytes = new TextEncoder().encode(payload);
  const decoder = new TextDecoder();
  const rows: FlightRow[] = [];
  let at = 0;
  while (at < bytes.length) {
    const colon = bytes.indexOf(0x3a, at);
    if (colon < 0) break;
    const id = decoder.decode(bytes.subarray(at, colon)).trim();
    let stop: number;
    if (bytes[colon + 1] === 0x54) {
      const comma = bytes.indexOf(0x2c, colon);
      stop = comma + 1 + Number.parseInt(decoder.decode(bytes.subarray(colon + 2, comma)), 16);
    } else {
      const end = bytes.indexOf(0x0a, colon);
      stop = end < 0 ? bytes.length : end;
    }
    const body = decoder.decode(bytes.subarray(colon + 1, stop));
    rows.push({ id, tag: /^[A-Z]/u.exec(body)?.[0] ?? "", body });
    at = bytes[stop] === 0x0a ? stop + 1 : stop;
  }
  return rows;
}

/**
 * Every client reference in a payload, from its `I[...]` rows. A development payload can send the
 * module id or the export name as a separate string row and point at it with `"$<row>"`, so those
 * are resolved.
 *
 * @param payload - The Flight payload text.
 * @returns The references in payload order.
 */
export function flightClientReferences(payload: string): FlightClientReference[] {
  const all = flightRows(payload);
  const rows = new Map(all.map(({ id, body }) => [id, body]));
  // A repeated string, such as an export name two references share, also moves to its own row.
  const resolved = (value: string): string =>
    value.startsWith("$") ? String(JSON.parse(rows.get(value.slice(1)) ?? '""')) : value;
  const references: FlightClientReference[] = [];
  for (const { tag, body } of all) {
    if (tag !== "I") continue;
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

/** One model row's JSON, with the row's body text for a failure's message. */
export type FlightModel = { readonly model: FlightJson; readonly body: string };

/** The JSON models of a Flight payload's model rows (`<hex id>:[…]` or `<hex id>:{…}`). */
export function flightModels(payload: string): FlightModel[] {
  return flightRows(payload).flatMap(({ body }) =>
    // SAFETY: Flight model rows are the I/O boundary. The body starts with `[` or `{`, and
    // JSON.parse yields only JSON values, so the result is a FlightJson array or object.
    body.startsWith("[") || body.startsWith("{") ? [{ model: JSON.parse(body) as FlightJson, body }] : []
  );
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

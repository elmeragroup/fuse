import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `slider.*` rows: a range thumb's name, joined to the
 * slider's own name when it has one.
 */
export const svSE = {
  rangeStart: (vars: Variables) => named(vars, "Minimum", "minimum"),
  rangeEnd: (vars: Variables) => named(vars, "Maximum", "maximum"),
  rangeThumb: (vars: Variables) =>
    named(vars, `Värde ${String(vars?.position)}`, `värde ${String(vars?.position)}`),
};

function named(vars: Variables, alone: string, joined: string): string {
  const name = String(vars?.name ?? "").trim();
  return name === "" ? alone : `${name}, ${joined}`;
}

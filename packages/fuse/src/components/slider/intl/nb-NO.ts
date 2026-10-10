import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `slider.*` rows: a range thumb's name, joined to the
 * slider's own name when it has one.
 */
export const nbNO = {
  rangeStart: (vars: Variables) => named(vars, "Minimum", "minimum"),
  rangeEnd: (vars: Variables) => named(vars, "Maksimum", "maksimum"),
  rangeThumb: (vars: Variables) =>
    named(vars, `Verdi ${String(vars?.position)}`, `verdi ${String(vars?.position)}`),
};

function named(vars: Variables, alone: string, joined: string): string {
  const name = String(vars?.name ?? "").trim();
  return name === "" ? alone : `${name}, ${joined}`;
}

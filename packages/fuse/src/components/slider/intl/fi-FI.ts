import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `slider.*` rows: a range thumb's name, joined to the
 * slider's own name when it has one.
 */
export const fiFI = {
  rangeStart: (vars: Variables) => named(vars, "Minimi", "minimi"),
  rangeEnd: (vars: Variables) => named(vars, "Maksimi", "maksimi"),
  rangeThumb: (vars: Variables) =>
    named(vars, `Arvo ${String(vars?.position)}`, `arvo ${String(vars?.position)}`),
};

function named(vars: Variables, alone: string, joined: string): string {
  const name = String(vars?.name ?? "").trim();
  return name === "" ? alone : `${name}, ${joined}`;
}

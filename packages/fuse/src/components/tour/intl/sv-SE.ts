import type { Variables } from "@internationalized/string";

/** The default localized copy for the `tour.*` rows. */
export const svSE = {
  next: "Nästa",
  back: "Tillbaka",
  done: "Klar",
  beacon: "Visa tips",
  skip: "Hoppa över",
  count: (vars: Variables) => `${String(vars?.current)} av ${String(vars?.total)}`,
  announcement: (vars: Variables) => `Steg ${String(vars?.current)} av ${String(vars?.total)}`,
};

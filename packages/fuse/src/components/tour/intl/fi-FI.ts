import type { Variables } from "@internationalized/string";

/** The default localized copy for the `tour.*` rows. */
export const fiFI = {
  next: "Seuraava",
  back: "Takaisin",
  done: "Valmis",
  skip: "Ohita",
  count: (vars: Variables) => `${String(vars?.current)}/${String(vars?.total)}`,
  announcement: (vars: Variables) => `Vaihe ${String(vars?.current)}/${String(vars?.total)}`,
};

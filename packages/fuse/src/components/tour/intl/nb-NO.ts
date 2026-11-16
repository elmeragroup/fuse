import type { Variables } from "@internationalized/string";

/** The default localized copy for the `tour.*` rows. */
export const nbNO = {
  next: "Neste",
  back: "Tilbake",
  done: "Ferdig",
  beacon: "Vis tips",
  skip: "Hopp over",
  count: (vars: Variables) => `${String(vars?.current)} av ${String(vars?.total)}`,
  announcement: (vars: Variables) => `Steg ${String(vars?.current)} av ${String(vars?.total)}`,
};

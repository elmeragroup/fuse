import type { Variables } from "@internationalized/string";

export const fiFI = {
  greeting: "Hei",
  removeItem: (vars: Variables) => `Poista ${String(vars?.item ?? "")}`,
};

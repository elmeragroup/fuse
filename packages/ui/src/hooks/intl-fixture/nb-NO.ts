import type { Variables } from "@internationalized/string";

export const nbNO = {
  greeting: "Hei",
  removeItem: (vars: Variables) => `Fjern ${String(vars?.item ?? "")}`,
};

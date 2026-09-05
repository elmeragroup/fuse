import type { Variables } from "@internationalized/string";

export const svSE = {
  greeting: "Hej",
  removeItem: (vars: Variables) => `Ta bort ${String(vars?.item ?? "")}`,
};

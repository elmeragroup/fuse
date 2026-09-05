import type { Variables } from "@internationalized/string";

export const enUS = {
  greeting: "Hello",
  removeItem: (vars: Variables) => `Remove ${String(vars?.item ?? "")}`,
};

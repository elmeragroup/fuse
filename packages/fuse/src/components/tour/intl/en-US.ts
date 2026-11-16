import type { Variables } from "@internationalized/string";

/** The default localized copy for the `tour.*` rows. */
export const enUS = {
  next: "Next",
  back: "Back",
  done: "Done",
  beacon: "Show tip",
  skip: "Skip",
  count: (vars: Variables) => `${String(vars?.current)} of ${String(vars?.total)}`,
  announcement: (vars: Variables) => `Step ${String(vars?.current)} of ${String(vars?.total)}`,
};

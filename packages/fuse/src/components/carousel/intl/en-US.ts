import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `carousel.*` rows: the role descriptions, the automatic slide and
 * indicator names, the controls' names and the visible status.
 */
export const enUS = {
  carousel: "carousel",
  slide: "slide",
  slideLabel: (vars: Variables) => `${String(vars?.position)} of ${String(vars?.count)}`,
  previous: "Previous slide",
  next: "Next slide",
  indicators: "Choose slide to display",
  indicator: (vars: Variables) => `Slide ${String(vars?.position)} of ${String(vars?.count)}`,
  status: (vars: Variables) => `${String(vars?.position)} of ${String(vars?.count)}`,
  startRotation: "Start automatic slide show",
  stopRotation: "Stop automatic slide show",
};

import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `carousel.*` rows: the role descriptions, the automatic slide and
 * indicator names, the controls' names and the visible status.
 */
export const nbNO = {
  carousel: "karusell",
  slide: "lysbilde",
  slideLabel: (vars: Variables) => `${String(vars?.position)} av ${String(vars?.count)}`,
  previous: "Forrige lysbilde",
  next: "Neste lysbilde",
  indicators: "Velg lysbilde",
  indicator: (vars: Variables) => `Lysbilde ${String(vars?.position)} av ${String(vars?.count)}`,
  status: (vars: Variables) => `${String(vars?.position)} av ${String(vars?.count)}`,
  startRotation: "Start automatisk visning",
  stopRotation: "Stopp automatisk visning",
};

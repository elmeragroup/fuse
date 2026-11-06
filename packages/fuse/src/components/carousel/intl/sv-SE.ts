import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `carousel.*` rows: the role descriptions, the automatic slide and
 * indicator names, the controls' names and the visible status.
 */
export const svSE = {
  carousel: "karusell",
  slide: "bild",
  slideLabel: (vars: Variables) => `${String(vars?.position)} av ${String(vars?.count)}`,
  previous: "Föregående bild",
  next: "Nästa bild",
  indicators: "Välj bild",
  indicator: (vars: Variables) => `Bild ${String(vars?.position)} av ${String(vars?.count)}`,
  status: (vars: Variables) => `${String(vars?.position)} av ${String(vars?.count)}`,
  startRotation: "Starta automatisk visning",
  stopRotation: "Stoppa automatisk visning",
};

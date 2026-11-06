import type { Variables } from "@internationalized/string";

/**
 * Default localized copy for the `carousel.*` rows: the role descriptions, the automatic slide and
 * indicator names, the controls' names and the visible status. Finnish writes a position in a set
 * as `3/6`, which avoids inflecting the count.
 */
export const fiFI = {
  carousel: "karuselli",
  slide: "dia",
  slideLabel: (vars: Variables) => `${String(vars?.position)}/${String(vars?.count)}`,
  previous: "Edellinen dia",
  next: "Seuraava dia",
  indicators: "Valitse näytettävä dia",
  indicator: (vars: Variables) => `Dia ${String(vars?.position)}/${String(vars?.count)}`,
  status: (vars: Variables) => `${String(vars?.position)}/${String(vars?.count)}`,
  startRotation: "Käynnistä automaattinen esitys",
  stopRotation: "Pysäytä automaattinen esitys",
};

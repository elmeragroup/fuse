/**
 * The live line family's own words in the four locales. They live apart from `CHART_STRINGS`, so a
 * cartesian route ships none of them. The module calls no hook, so a server component reads it too.
 */
import type { SupportedLocale } from "../../../intl/locale-context";

/** The words only a live line Root and its readout read. */
export type LiveStrings = {
  /** The keyboard instructions of a live line chart. */
  readonly instructionsLive: string;
  /** The value's name in a live line chart's readout when Root has no `label`. */
  readonly liveValue: string;
  /** A live line chart's latest reading, such as `Siste verdi 1,78 kroner kl. 12:00:05.` */
  readonly liveLatest: (value: string, at: string) => string;
};

const NB_NO: LiveStrings = {
  instructionsLive: "Bruk venstre og høyre pil for å gå mellom målingene, og End for å gå til den siste.",
  liveValue: "Verdi",
  liveLatest: (value, at) => `Siste verdi ${value} ${at}.`,
};

const SV_SE: LiveStrings = {
  instructionsLive:
    "Använd vänster- och högerpil för att gå mellan mätningarna, och End för att gå till den senaste.",
  liveValue: "Värde",
  liveLatest: (value, at) => `Senaste värde ${value} ${at}.`,
};

const FI_FI: LiveStrings = {
  instructionsLive:
    "Siirry mittausten välillä vasemmalla ja oikealla nuolella ja viimeisimpään End-näppäimellä.",
  liveValue: "Arvo",
  liveLatest: (value, at) => `Viimeisin arvo ${value} ${at}.`,
};

const EN_US: LiveStrings = {
  instructionsLive: "Use the left and right arrows to move between readings, and End to go to the latest.",
  liveValue: "Value",
  liveLatest: (value, at) => `Latest value ${value} ${at}.`,
};

/** The live line words per locale. */
export const LIVE_STRINGS = {
  "nb-NO": NB_NO,
  "sv-SE": SV_SE,
  "fi-FI": FI_FI,
  "en-US": EN_US,
} as const satisfies { readonly [L in SupportedLocale]: LiveStrings };

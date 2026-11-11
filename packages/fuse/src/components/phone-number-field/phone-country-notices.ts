import type { PhoneCountryCode, PhoneNumberCountry } from "./phone-engine";

/**
 * What `onCountryChange` tells a parent, as a reducer over observations of the field: the
 * country it shows, the country a proposal waiting for the parent would show, and the
 * controlled `countryCode`, each observation ordered by a version.
 *
 * The notice contract under a controlled `countryCode`: a disagreement is the field's current
 * country, the country of a proposal that waits for the parent, else the shown one, differing
 * from `countryCode`, and is identified by that pair. It is announced once, as it starts. It
 * continues while the pair holds, as when the parent's props show the waiting proposal or a new
 * proposal keeps its country. It ends when the current country is `countryCode` again or another
 * country, or when `countryCode` changes. A pair that starts again after an end is announced
 * again. Without a controlled country, a commit that shows another country announces it.
 */

/** The field at one moment, as the notices read it. */
export type CountryObservation = {
  /**
   * Orders observations: a later state of the field has a greater version. An observation older
   * than one the notices took in is out of date and changes nothing.
   */
  readonly version: number;
  /** The controlled country, as the parent wrote it, or undefined. */
  readonly countryCode: PhoneCountryCode | undefined;
  /** The country the field shows. */
  readonly shown: Readonly<PhoneNumberCountry>;
  /** The country of a proposal that waits for the parent, or null. */
  readonly proposed: Readonly<PhoneNumberCountry> | null;
};

/** What `onCountryChange` has told the parent. Read-only; start it with {@link startCountryNotices}. */
export type CountryNotices = {
  /** The country the last commit showed. */
  readonly shown: PhoneCountryCode;
  /** The ongoing disagreement, `countryCode` and the current country, or null. */
  readonly disagreement: string | null;
  /** The version of the newest observation the notices took in. */
  readonly version: number;
};

/** What {@link publishedCountry} and {@link committedCountry} return. */
export type CountryNotice = {
  /** The notices after the observation. */
  readonly notices: CountryNotices;
  /** The country to announce, or null. */
  readonly country: Readonly<PhoneNumberCountry> | null;
};

/**
 * The notices before a field's first commit, which has announced nothing.
 *
 * @param observation - The field's first state.
 * @returns Notices that hold the country it shows.
 */
export function startCountryNotices(observation: CountryObservation): CountryNotices {
  return { shown: observation.shown.code, disagreement: null, version: observation.version };
}

function step(
  notices: CountryNotices,
  { version, countryCode, shown, proposed }: CountryObservation,
  moment: "publish" | "commit"
): CountryNotice {
  // An observation older than one the notices took in, as the first commit's passive effect
  // after hydration proposed a typed number from its layout effect, tells the parent nothing
  // new and must not undo what the newer one announced.
  if (version < notices.version) return { notices, country: null };
  const shownAfter = moment === "commit" ? shown.code : notices.shown;
  if (countryCode === undefined) {
    const changed = moment === "commit" && shown.code !== notices.shown;
    return { notices: { shown: shownAfter, disagreement: null, version }, country: changed ? shown : null };
  }
  const current = proposed ?? shown;
  const disagreement = current.code === countryCode ? null : `${countryCode}>${current.code}`;
  const starts = disagreement !== null && disagreement !== notices.disagreement;
  return { notices: { shown: shownAfter, disagreement, version }, country: starts ? current : null };
}

/**
 * The country a transition announces as it proposes: the proposal's country, when it starts a
 * disagreement. Record the result before calling any consumer callback, so a parent that commits
 * synchronously inside one finds the proposal already taken in.
 *
 * @param notices - What the parent was told.
 * @param observation - The state the transition returned.
 * @returns The notices, and the country to announce, or null.
 */
export function publishedCountry(notices: CountryNotices, observation: CountryObservation): CountryNotice {
  return step(notices, observation, "publish");
}

/**
 * The country a commit announces. A code the parent just set, which the field then shows, never
 * announces.
 *
 * @param notices - What the parent was told.
 * @param observation - The committed state.
 * @returns The notices, and the country to announce, or null.
 */
export function committedCountry(notices: CountryNotices, observation: CountryObservation): CountryNotice {
  return step(notices, observation, "commit");
}

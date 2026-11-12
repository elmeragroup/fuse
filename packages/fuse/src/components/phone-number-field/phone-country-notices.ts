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

/** What `onCountryChange` has told the parent. */
type CountryNotices = {
  /** The country the last commit showed. */
  readonly shown: PhoneCountryCode;
  /** The ongoing disagreement, `countryCode` and the current country, or null. */
  readonly disagreement: string | null;
  /** The version of the newest observation the notices took in. */
  readonly version: number;
};

/** The notices after one observation, and the country it announces. */
type CountryStep = {
  /** The notices after the observation. */
  readonly notices: CountryNotices;
  /** The country to announce, or null. */
  readonly country: Readonly<PhoneNumberCountry> | null;
};

function step(
  notices: CountryNotices,
  { version, countryCode, shown, proposed }: CountryObservation,
  moment: "publish" | "commit"
): CountryStep {
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
 * What `onCountryChange` hears from one field, observation by observation. Each call takes the
 * observation in before it returns, so a parent that commits synchronously inside the callback
 * the caller then runs finds it already taken in.
 */
export type CountryAnnouncer = {
  /**
   * The country a transition announces as it proposes: the proposal's country, when it starts a
   * disagreement.
   */
  readonly publish: (observation: CountryObservation) => Readonly<PhoneNumberCountry> | null;
  /** The country a commit announces. A code the parent just set, which the field then shows, never announces. */
  readonly commit: (observation: CountryObservation) => Readonly<PhoneNumberCountry> | null;
};

/**
 * The announcer for a field, before its first commit, which has announced nothing.
 *
 * @param first - The field's first state.
 * @returns An announcer that holds the country the first state shows.
 */
export function createCountryAnnouncer(first: CountryObservation): CountryAnnouncer {
  let notices: CountryNotices = { shown: first.shown.code, disagreement: null, version: first.version };
  const take = (observation: CountryObservation, moment: "publish" | "commit") => {
    const next = step(notices, observation, moment);
    notices = next.notices;
    return next.country;
  };
  return {
    publish: (observation) => take(observation, "publish"),
    commit: (observation) => take(observation, "commit"),
  };
}

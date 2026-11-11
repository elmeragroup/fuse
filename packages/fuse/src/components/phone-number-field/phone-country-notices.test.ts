import { describe, expect, it } from "vitest";

import { committedCountry, publishedCountry, startCountryNotices } from "./phone-country-notices";
import type { CountryNotice, CountryNotices, CountryObservation } from "./phone-country-notices";
import type { PhoneCountryCode, PhoneNumberCountry } from "./phone-engine";

const COUNTRY = {
  FI: { code: "FI", dialCode: "+358" },
  NO: { code: "NO", dialCode: "+47" },
  SE: { code: "SE", dialCode: "+46" },
  US: { code: "US", dialCode: "+1" },
} as const satisfies Partial<Record<PhoneCountryCode, PhoneNumberCountry>>;

/** The field under `countryCode` NO, showing `shown`, with a waiting proposal of `proposed`. */
function underNorway(
  version: number,
  shown: keyof typeof COUNTRY,
  proposed: keyof typeof COUNTRY | null = null
): CountryObservation {
  return {
    version,
    countryCode: "NO",
    shown: COUNTRY[shown],
    proposed: proposed === null ? null : COUNTRY[proposed],
  };
}

/** Feeds observations to the notices as the hook does and records what `onCountryChange` hears. */
function announcer(first: CountryObservation) {
  let notices: CountryNotices = startCountryNotices(first);
  const heard: string[] = [];
  const take = (notice: CountryNotice) => {
    notices = notice.notices;
    if (notice.country) heard.push(notice.country.code);
  };
  return {
    heard,
    publish: (observation: CountryObservation) => take(publishedCountry(notices, observation)),
    commit: (observation: CountryObservation) => take(committedCountry(notices, observation)),
  };
}

describe("country notices", () => {
  it("ends a rejected pick's disagreement with the props that drop it, so later ones announce", () => {
    // A Swedish controlled value under NO; the parent rejects a FI pick, then sets a US number,
    // then a Finnish one.
    const notices = announcer(underNorway(0, "SE"));
    notices.commit(underNorway(0, "SE"));
    notices.publish(underNorway(1, "SE", "FI"));
    // The parent rejects: its props stay, and the field shows SE again beside the waiting pick.
    notices.commit(underNorway(1, "SE", "FI"));
    notices.commit(underNorway(2, "US"));
    notices.commit(underNorway(3, "FI"));
    expect(notices.heard).toEqual(["SE", "FI", "US", "FI"]);
  });

  it("continues the disagreement a proposal started through a delayed echo", () => {
    // An empty field under NO; a Swedish paste waits for the parent, which echoes it later.
    const notices = announcer(underNorway(0, "NO"));
    notices.commit(underNorway(0, "NO"));
    notices.publish(underNorway(1, "NO", "SE"));
    // The commit of the paste, while the parent is still handling `onChange`.
    notices.commit(underNorway(1, "NO", "SE"));
    notices.commit(underNorway(2, "SE"));
    expect(notices.heard).toEqual(["SE"]);
  });
});

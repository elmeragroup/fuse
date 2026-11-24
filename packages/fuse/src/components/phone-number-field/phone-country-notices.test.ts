import { describe, expect, it } from "vitest";

import { createCountryAnnouncer } from "./phone-country-notices";
import type { CountryObservation } from "./phone-country-notices";
import * as PhoneEditor from "./phone-editor";
import type { PhoneEditorProps } from "./phone-editor";
import type { PhoneCountryCode, PhoneNumberCountry, PhoneNumberFormat } from "./phone-engine";

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
    alreadyShown: false,
  };
}

/** Feeds observations to the announcer and records what `onCountryChange` hears. */
function announcer(first: CountryObservation) {
  const announce = createCountryAnnouncer(first);
  const heard: PhoneCountryCode[] = [];
  const take = (country: Readonly<PhoneNumberCountry> | null) => {
    if (country) heard.push(country.code);
  };
  return {
    heard,
    publish: (observation: CountryObservation) => take(announce.publish(observation)),
    commit: (observation: CountryObservation) => take(announce.commit(observation)),
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

  it("announces a disagreement again when it starts again after an end", () => {
    const notices = announcer(underNorway(0, "NO"));
    notices.commit(underNorway(1, "SE"));
    notices.commit(underNorway(2, "NO"));
    notices.commit(underNorway(3, "SE"));
    expect(notices.heard).toEqual(["SE", "SE"]);
  });

  type Row = {
    readonly name: string;
    readonly outputFormat: PhoneNumberFormat;
    readonly commitPasteWithSameProps: boolean;
  };
  const rows: readonly Row[] = (["e164", "international", "national", "raw"] as const).flatMap(
    (outputFormat) => [
      {
        name: `${outputFormat}, props change on the first render after paste`,
        outputFormat,
        commitPasteWithSameProps: false,
      },
      {
        name: `${outputFormat}, paste commits with the same props first`,
        outputFormat,
        commitPasteWithSameProps: true,
      },
    ]
  );

  /** One commit as the parent sees it: the country the field shows, and what `onCountryChange` hears. */
  type Commit = { readonly shows: PhoneCountryCode; readonly hears: readonly PhoneCountryCode[] };

  /** What the parent sees of a trace: each commit before the paste, the paste, and each commit after. */
  type Trace = {
    readonly before: readonly Commit[];
    readonly paste: { readonly hears: readonly PhoneCountryCode[] };
    readonly after: readonly Commit[];
  };

  /** What happens to the field: its props, the paste, and the renders around it. */
  type Scenario = {
    /** The props the field mounts with, under the row's output format. */
    readonly props: PhoneEditorProps;
    /** Prop changes the field renders after the mount and before the paste. */
    readonly first?: readonly Partial<PhoneEditorProps>[];
    /** The text the user pastes. */
    readonly paste: string;
    /** Prop changes the field renders after the paste, each over the props it pasted under. */
    readonly then: readonly Partial<PhoneEditorProps>[];
  };

  /**
   * Mounts the field, renders the scenario's changes, lets the user paste, and renders the
   * changes after it, first the props it pasted under again when the row commits the paste with
   * the same props. Returns what the parent saw.
   */
  function pasteThenRender({ outputFormat, commitPasteWithSameProps }: Row, scenario: Scenario): Trace {
    let props: PhoneEditorProps = { ...scenario.props, outputFormat };
    let state = PhoneEditor.create(props);
    const notices = announcer(PhoneEditor.observeCountry(state));
    const hears = () => notices.heard.splice(0);
    const render = (next: PhoneEditorProps): Commit => {
      state = PhoneEditor.reconcile(state, next);
      notices.commit(PhoneEditor.observeCountry(state));
      return { shows: PhoneEditor.view(state).country.code, hears: hears() };
    };
    const before = [render(props)];
    for (const change of scenario.first ?? []) {
      props = { ...props, ...change };
      before.push(render(props));
    }
    state = PhoneEditor.paste(state, scenario.paste);
    notices.publish(PhoneEditor.observeCountry(state));
    const paste = { hears: hears() };
    const pasted = props;
    const after = [
      ...(commitPasteWithSameProps ? [render(pasted)] : []),
      ...scenario.then.map((change) => render({ ...pasted, ...change })),
    ];
    return { before, paste, after };
  }

  /**
   * The trace a row expects. A paste under a controlled `value` waits for the parent, so its own
   * commit with the same props shows what the last commit before it showed, and hears nothing.
   */
  function expected(
    { commitPasteWithSameProps }: Row,
    before: readonly Commit[],
    paste: readonly PhoneCountryCode[],
    after: readonly Commit[]
  ): Trace {
    const last = before.at(-1);
    const pasteCommit =
      commitPasteWithSameProps && last !== undefined ? [{ shows: last.shows, hears: [] }] : [];
    return { before, paste: { hears: paste }, after: [...pasteCommit, ...after] };
  }

  /**
   * The trace of a field that shows SE at mount and announces it, takes the paste silently,
   * shows `away` for one render, and then shows SE again, which starts the disagreement anew.
   */
  const swedenTwice = (row: Row, away: PhoneCountryCode) =>
    expected(
      row,
      [{ shows: "SE", hears: ["SE"] }],
      [],
      [
        { shows: away, hears: [] },
        { shows: "SE", hears: ["SE"] },
      ]
    );

  /** The Swedish number +46 70 123 45 67, in its E.164 form. */
  const SWEDISH = "+46701234567";
  /** The field under SJ whose controlled value names SE and holds the number the user pastes. */
  const swedishUnderSvalbard: PhoneEditorProps = {
    countryCode: "SJ",
    countries: ["SE", "SJ"],
    value: SWEDISH,
  };
  /** A countryless value the parent stores under `international`, which shows `countryCode`. */
  const countryless = { international: true, value: "0701234567" } as const;

  it.each(rows)(
    "announces SE a second time when the Swedish value returns after a countryless one ($name)",
    (row) => {
      // The parent stores the countryless form, which shows SJ, then the Swedish number again
      // under the same `international`.
      const trace = pasteThenRender(row, {
        props: swedishUnderSvalbard,
        paste: SWEDISH,
        then: [countryless, { ...countryless, value: SWEDISH }],
      });
      expect(trace).toEqual(swedenTwice(row, "SJ"));
    }
  );

  it.each(rows)(
    "announces SE a second time when detection turns off for one render and back on ($name)",
    (row) => {
      // Without detection the value names no country, so the field shows SJ.
      const trace = pasteThenRender(row, {
        props: swedishUnderSvalbard,
        paste: SWEDISH,
        then: [{ autoDetectCountry: false }, {}],
      });
      expect(trace).toEqual(swedenTwice(row, "SJ"));
    }
  );

  it.each(rows)(
    "announces SE a second time when a fallback countryCode starts showing its own country ($name)",
    (row) => {
      // CA is not offered, so the field resolves it to SE and shows the Swedish value there. Once
      // the parent offers CA, a countryless value shows CA, and the Swedish one shows SE anew.
      const offersCanada = { ...countryless, countries: ["SE", "CA"] } as const;
      const trace = pasteThenRender(row, {
        props: { countryCode: "CA", countries: ["SE"], value: SWEDISH },
        paste: SWEDISH,
        then: [offersCanada, { ...offersCanada, value: SWEDISH }],
      });
      expect(trace).toEqual(swedenTwice(row, "CA"));
    }
  );

  it.each(rows)(
    "announces SE a second time when the parent offers the controlled country and stores the national number ($name)",
    (row) => {
      // NO is not offered, so the field shows the Swedish value in SE. Once the parent offers NO,
      // the national value names no country and shows NO, and the Swedish one shows SE anew.
      const offersNorway = { countries: ["NO", "SE"], value: "0701234567" } as const;
      const trace = pasteThenRender(row, {
        props: { countryCode: "NO", countries: ["SE"], value: SWEDISH },
        paste: SWEDISH,
        then: [offersNorway, { ...offersNorway, value: SWEDISH }],
      });
      expect(trace).toEqual(swedenTwice(row, "NO"));
    }
  );

  it.each(rows)("announces SE once when the paste waits while the field shows SJ ($name)", (row) => {
    // The value starts countryless, so the field shows SJ and the paste waits in SE. The
    // countryless answer and the Swedish value that follows continue that one disagreement.
    const trace = pasteThenRender(row, {
      props: { ...swedishUnderSvalbard, value: "701234567" },
      paste: SWEDISH,
      then: [countryless, { ...countryless, value: SWEDISH }],
    });
    expect(trace).toEqual(
      expected(
        row,
        [{ shows: "SJ", hears: [] }],
        ["SE"],
        [
          { shows: "SJ", hears: [] },
          { shows: "SE", hears: [] },
        ]
      )
    );
  });

  it.each(rows)(
    "announces SE once when the paste waits on a value whose trunk zero the field kept ($name)",
    (row) => {
      // Under `international` the field keeps the trunk zero of +46 00 70 123 45 67, and keeps
      // that number when `international` turns off, so it never showed the pasted one. The paste
      // waits in SE through the countryless answer, and the Swedish value continues it.
      const trace = pasteThenRender(row, {
        props: { ...swedishUnderSvalbard, value: "+4600701234567", international: true },
        first: [{ international: false }],
        paste: SWEDISH,
        then: [countryless, { ...countryless, value: SWEDISH }],
      });
      expect(trace).toEqual(
        expected(
          row,
          [
            { shows: "SE", hears: ["SE"] },
            { shows: "SE", hears: [] },
          ],
          [],
          [
            { shows: "SJ", hears: [] },
            { shows: "SE", hears: [] },
          ]
        )
      );
    }
  );

  it.each(rows)(
    "announces SE when the parent offers it, after the field showed the pasted number in a fallback FI ($name)",
    (row) => {
      // SJ and SE are not offered, so the field shows the Swedish value in FI, where the paste
      // lands too. Offering SE shows the value in SE and SJ resolves to NO: a new disagreement.
      const trace = pasteThenRender(row, {
        props: { countryCode: "SJ", countries: ["FI"], value: SWEDISH, international: true },
        paste: SWEDISH,
        then: [{ countries: ["FI", "NO", "SE"] }],
      });
      expect(trace).toEqual(
        expected(row, [{ shows: "FI", hears: ["FI"] }], [], [{ shows: "SE", hears: ["SE"] }])
      );
    }
  );

  it.each(rows)(
    "announces FI when detection turns on, after the field showed the pasted Finnish number in NO ($name)",
    (row) => {
      // SJ falls back to NO. Without detection the Finnish value shows in NO, where the paste
      // lands too. Detection then shows the value in FI: a new disagreement.
      const trace = pasteThenRender(row, {
        props: {
          countryCode: "SJ",
          countries: ["FI", "NO"],
          autoDetectCountry: false,
          value: "+358401234567",
        },
        paste: "+358401234567",
        then: [{ autoDetectCountry: true }],
      });
      expect(trace).toEqual(
        expected(row, [{ shows: "NO", hears: ["NO"] }], [], [{ shows: "FI", hears: ["FI"] }])
      );
    }
  );
});

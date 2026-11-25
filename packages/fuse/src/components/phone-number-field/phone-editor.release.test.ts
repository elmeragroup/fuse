import fc from "fast-check";
import type { CountryCode, MetadataJson } from "libphonenumber-js/core";
import maxMetadata from "libphonenumber-js/metadata.max.json";
import { describe, expect, it } from "vitest";

import { phoneEditorFixtures } from "../../../test/phone-editor-fixtures";
import { outcome } from "../../../test/phone-editor-outcome";
import { namedCountry, resolveCode } from "../../../test/phone-number-oracle";
import {
  pasteText,
  traceCatalog,
  traceCode,
  traceFormat,
  tracePaste,
} from "../../../test/phone-trace-arbitraries";
import * as PhoneEditor from "./phone-editor";
import type { PhoneEditorProps } from "./phone-editor";
import { defaultMetadata } from "./phone-engine";

const { shown } = phoneEditorFixtures(PhoneEditor);

/**
 * The default catalog with `code`'s entry cut to its first five fields, which leaves it no trunk
 * prefix.
 */
function withoutTrunkPrefix(code: CountryCode): MetadataJson {
  return {
    ...defaultMetadata,
    countries: { ...defaultMetadata.countries, [code]: defaultMetadata.countries[code]?.slice(0, 5) },
  };
}

/**
 * The editor created with `props`. When `paste` is set, the user pastes it and the parent
 * rerenders with the same props, so the paste can still wait.
 */
function startState(props: PhoneEditorProps, paste: string | undefined): PhoneEditor.PhoneEditorState {
  const created = PhoneEditor.create(props);
  return paste === undefined ? created : PhoneEditor.reconcile(PhoneEditor.paste(created, paste), props);
}

/**
 * Unit under test: `PhoneEditor.reconcile` when the parent releases a controlled `value` in the
 * render that replaces the metadata, or in the render after it (#1015). Oracle: literal numbers
 * from #1015, and contract (xiii):
 *
 * - (xiii) a release's outcome does not depend on a configuration change before it: props that
 *   release `value` together with a change of configuration leave the field as they do when that
 *   change came first, with the value still held. It covers a change that keeps where the
 *   controlled code resolves and the country the held value names.
 */
describe("PhoneEditor release of a controlled value with a metadata replacement", () => {
  const auWithoutTrunkPrefix = withoutTrunkPrefix("AU");

  it.each([
    {
      name: "a national AU value under AU control",
      held: { value: "0401 234 567", countryCode: "AU", countries: ["AU"], outputFormat: "e164" },
      replace: { metadata: auWithoutTrunkPrefix, outputFormat: "national" },
      release: {},
      expected: { display: "0401234567", output: "+610401234567", country: "AU" },
    },
    {
      name: "a national AU value read in the default country, when AU control starts with the release",
      held: { value: "0401 234 567", defaultCountryCode: "AU", countries: ["AU"], outputFormat: "e164" },
      replace: { metadata: auWithoutTrunkPrefix },
      release: { countryCode: "AU" },
      expected: { display: "+61401234567", output: "+61401234567", country: "AU" },
    },
    {
      name: "a paste that waits under a fallback code, when the parent then names AU",
      held: { value: "0401 234 567", countryCode: "NZ", countries: ["AU"], outputFormat: "raw" },
      paste: "0401234567",
      replace: { countryCode: "AU", metadata: auWithoutTrunkPrefix, outputFormat: "national" },
      release: {},
      expected: { display: "+61401234567", output: "+61401234567", country: "AU" },
    },
  ] as const)(
    "keeps the same number when metadata changes before or with the release: $name",
    ({ held, paste, replace, release, expected }) => {
      const state = startState(held, paste);
      const { value: _released, ...released } = { ...held, ...replace, ...release };
      // A last render that asks for E.164 output, applied to both paths.
      const final = (after: PhoneEditor.PhoneEditorState) =>
        PhoneEditor.reconcile(after, { ...released, outputFormat: "e164" });
      const split = PhoneEditor.reconcile(PhoneEditor.reconcile(state, { ...held, ...replace }), released);
      expect(shown(final(split)), "replacement first").toEqual(expected);
      expect(shown(final(PhoneEditor.reconcile(state, released))), "together").toEqual(expected);
    }
  );

  it("settles a release once when the metadata it passes is a shallow copy", () => {
    const held = {
      value: "+46 (0)70-123 45 67",
      countryCode: "FI",
      countries: ["FI", "SE"],
      outputFormat: "raw",
    } as const;
    const released = PhoneEditor.reconcile(PhoneEditor.create(held), {
      countryCode: "FI",
      countries: ["FI", "SE"],
      outputFormat: "raw",
      autoDetectCountry: false,
      metadata: { ...defaultMetadata },
    });
    expect(shown(released).output).toBe("+46701234567");
  });

  it("clears the number when the release and the metadata replacement come with a new controlled country", () => {
    const held = {
      value: "0401 234 567",
      countryCode: "AU",
      countries: ["AU", "NZ"],
      outputFormat: "e164",
    } as const;
    const state = PhoneEditor.create(held);
    const released = PhoneEditor.reconcile(state, {
      countryCode: "NZ",
      countries: ["AU", "NZ"],
      outputFormat: "e164",
      metadata: auWithoutTrunkPrefix,
    });
    expect(shown(released)).toEqual({ display: "", output: "", country: "NZ" });
  });

  /**
   * A release's outcome does not depend on a configuration change before it. Take a field with a
   * controlled `value` under a controlled `countryCode`, after no paste or after a paste and a
   * rerender with unchanged props, so the paste can still wait. For props P that release `value`
   * and change the configuration, `reconcile(state, P)` equals
   * `reconcile(reconcile(state, P'), P)`, where P' is P with the value still held. Both paths agree
   * in what {@link outcome} compares. The catalogs include one whose SE entry has no trunk prefix,
   * so a replaced catalog reads a national value's leading 0 as part of the number. The fixed
   * example holds national digits under SJ, which name no country, and pastes the same digits. The
   * render that replaces the catalog with the value held takes the paste, which the max catalog
   * reads in NO.
   *
   * Unit under test: `PhoneEditor.reconcile`. Oracle: the same editor given the configuration change
   * first, which must agree with the one-render path, as contract (xiii) states.
   */
  it("releases a value to the same outcome after a configuration change alone", () => {
    const catalogs = {
      min: defaultMetadata,
      max: maxMetadata,
      "SE untrunked": withoutTrunkPrefix("SE"),
    } as const satisfies Record<string, MetadataJson>;
    type Catalog = keyof typeof catalogs;
    const catalog = fc.constantFrom<Catalog>("min", "max", "SE untrunked");
    const configuration = {
      countries: traceCatalog,
      outputFormat: traceFormat,
      international: fc.boolean(),
      formatOnType: fc.boolean(),
      autoDetectCountry: fc.boolean(),
      metadata: catalog,
    };
    const pasteValue = tracePaste.map(({ country, form }) => pasteText(country, form));
    const stored = fc.record({ ...configuration, value: pasteValue, countryCode: traceCode });
    const change = fc.record(configuration, { requiredKeys: [] });
    const pasted = fc.option(pasteValue, { nil: undefined });
    const propsOf = ({
      metadata,
      ...rest
    }: { readonly metadata: Catalog } & Omit<PhoneEditorProps, "metadata">): PhoneEditorProps => ({
      ...rest,
      metadata: catalogs[metadata],
    });
    fc.assert(
      fc.property(stored, change, pasted, (before, delta, paste) => {
        const configured = { ...before, ...delta };
        const { countryCode } = before;
        // Exclusion 1, the pick rule: a change that moves where the controlled code resolves picks
        // that country. On the direct path the pick clears the number the release frees, while on
        // the split path the held value outlasts the pick.
        fc.pre(resolveCode(configured.countries, countryCode) === resolveCode(before.countries, countryCode));
        // Exclusion 2, rule (i): a change of the country the held value names is no pick, but only
        // a held value names one. Adding SE to an FI-controlled picker with detection makes a held
        // `+46 (0)701234567` name SE, so the split path reads it there as +46701234567. The direct
        // path releases the value unread and keeps the +460701234567 shown before.
        fc.pre(namedCountry(configured) === namedCountry(before));
        const { value: _released, ...released } = configured;
        const state = startState(propsOf(before), paste);
        const direct = PhoneEditor.reconcile(state, propsOf(released));
        const split = PhoneEditor.reconcile(
          PhoneEditor.reconcile(state, propsOf(configured)),
          propsOf(released)
        );
        expect(outcome(direct)).toEqual(outcome(split));
      }),
      {
        seed: 1015,
        numRuns: 2000,
        examples: [
          [
            {
              countries: ["NO", "SJ"],
              outputFormat: "raw",
              international: false,
              formatOnType: true,
              autoDetectCountry: true,
              metadata: "min",
              value: pasteText("FI", "national"),
              countryCode: "SJ",
            },
            { metadata: "max" },
            pasteText("FI", "national"),
          ],
        ],
      }
    );
  });
});

/**
 * The theme vocabulary of pre-identity deployments. Before Fuse renamed its theme variant to
 * identity, a page stamped `data-theme-variant="internal" | "external"` and its pickers labelled
 * the axis "Variant" with "Internal" and "External". A pr-shots run takes its "before" shots from
 * such a deployment while a change still under review renames the axis, so the capture reads each
 * page's vocabulary and translates it. The CLI only ever takes the new names; this module is the
 * one place the retired ones live, and it can go once no deployment pr-shots shoots predates the
 * rename.
 */

import { THEME_AXES } from "@elmeragroup/fuse/theme-catalog";

import { identityLabel } from "./options.ts";
import type { Identity } from "./options.ts";

/** Which theme vocabulary a page speaks. */
export type ThemeVocabulary = "identity" | "variant";

/** The attribute a pre-identity page stamps the identity axis with. */
const LEGACY_IDENTITY_ATTRIBUTE = "data-theme-variant";

/** Each identity's retired variant value and picker label. */
const LEGACY_IDENTITY = {
  neutral: { value: "internal", label: "Internal" },
  branded: { value: "external", label: "External" },
} as const satisfies Record<Identity, { readonly value: string; readonly label: string }>;

/** The picker's name for the identity axis in each vocabulary. */
const AXIS_LABEL = { identity: "Identity", variant: "Variant" } as const satisfies Record<
  ThemeVocabulary,
  string
>;

/**
 * The picker's group name for the identity axis.
 *
 * @param vocabulary - The page's vocabulary.
 * @returns `Identity`, or `Variant` on a pre-identity page.
 */
export function identityAxisLabel(vocabulary: ThemeVocabulary): string {
  return AXIS_LABEL[vocabulary];
}

/**
 * The picker's label for an identity in the page's vocabulary.
 *
 * @param identity - The identity the run asked for.
 * @param vocabulary - The page's vocabulary.
 * @returns Its picker label, such as `Branded`, or the retired label, such as `External`, on a
 *   pre-identity page.
 */
export function identityOptionLabel(identity: Identity, vocabulary: ThemeVocabulary): string {
  return vocabulary === "identity" ? identityLabel(identity) : LEGACY_IDENTITY[identity].label;
}

/** What the slug reader passes into the page: the attribute names and the retired value map. */
export type ThemeReading = {
  /** The axis attributes in slug order, the identity's first. */
  readonly attributes: readonly string[];
  /** The retired identity attribute. */
  readonly legacyAttribute: string;
  /** Each retired identity value and the identity it names. */
  readonly legacyValues: Readonly<Record<string, string>>;
};

/** The serialisable reading a page evaluates in {@link readThemeSlug}. */
export const THEME_READING: ThemeReading = {
  attributes: THEME_AXES.map((axis) => axis.attribute),
  legacyAttribute: LEGACY_IDENTITY_ATTRIBUTE,
  legacyValues: Object.fromEntries(
    Object.entries(LEGACY_IDENTITY).map(([identity, { value }]) => [value, identity])
  ),
};

/**
 * Reads an element's `<identity>-<brand>-<segment>` slug in the identity vocabulary, whichever
 * vocabulary the element is stamped in. It runs in the page, so it takes everything it reads as
 * its argument.
 *
 * @param element - The themed element.
 * @param reading - {@link THEME_READING}.
 * @returns The slug, with a retired identity value translated, and `null` for a missing axis.
 */
export function readThemeSlug(element: Element, reading: ThemeReading): string {
  const [identityAttribute, ...rest] = reading.attributes;
  const legacy = element.getAttribute(reading.legacyAttribute);
  const identity =
    (identityAttribute === undefined ? null : element.getAttribute(identityAttribute)) ??
    (legacy === null ? null : (reading.legacyValues[legacy] ?? legacy));
  return [identity, ...rest.map((name) => element.getAttribute(name))].join("-");
}

/**
 * Reads which vocabulary an element is stamped in. A page that stamps neither attribute is read
 * in the identity vocabulary.
 *
 * @param element - The themed element.
 * @param reading - {@link THEME_READING}.
 * @returns `variant` when only the retired attribute is present.
 */
export function readThemeVocabulary(element: Element, reading: ThemeReading): ThemeVocabulary {
  const [identityAttribute] = reading.attributes;
  const stampsIdentity = identityAttribute !== undefined && element.hasAttribute(identityAttribute);
  return !stampsIdentity && element.hasAttribute(reading.legacyAttribute) ? "variant" : "identity";
}

/**
 * The `accept` attribute as a reusable rule. {@link parse} reads the string once, and the
 * match functions answer every later question without parsing again.
 *
 * The rules follow the HTML `accept` attribute, read leniently. `parse`
 * splits the string on commas, then trims and lowercases each token. A `.ext` token matches
 * the end of a file name, a `type/*` token matches a top-level MIME type, and any other token
 * with a `/` matches one MIME type exactly. Other tokens are ignored, and a rule with no
 * usable token accepts every file.
 */

/** A parsed `accept` string. Build one with {@link parse}. */
export type AcceptRule =
  | { readonly _tag: "any" }
  | {
      readonly _tag: "listed";
      /** Exact MIME types, lowercased. */
      readonly mimeTypes: ReadonlySet<string>;
      /** Top-level types from `type/*` tokens, lowercased and without the `/*`. */
      readonly topLevelTypes: ReadonlySet<string>;
      /** Extensions with their leading dot, lowercased. */
      readonly extensions: readonly string[];
    };

const ANY: AcceptRule = { _tag: "any" };

/**
 * Parse an `accept` attribute value.
 *
 * @param accept - The attribute's value, or `undefined` when the attribute is absent.
 * @returns The rule, which accepts every file when `accept` holds no usable token.
 */
export function parse(accept: string | undefined): AcceptRule {
  const mimeTypes = new Set<string>();
  const topLevelTypes = new Set<string>();
  const extensions: string[] = [];
  for (const raw of (accept ?? "").split(",")) {
    const token = raw.trim().toLowerCase();
    if (token.startsWith(".")) {
      extensions.push(token);
    } else if (token.endsWith("/*")) {
      topLevelTypes.add(token.slice(0, -2));
    } else if (token.includes("/")) {
      mimeTypes.add(token);
    }
  }
  if (mimeTypes.size === 0 && topLevelTypes.size === 0 && extensions.length === 0) {
    return ANY;
  }
  return { _tag: "listed", mimeTypes, topLevelTypes, extensions };
}

/**
 * Whether a MIME type alone satisfies the rule, as a drag that reports item types but no
 * names needs to know.
 *
 * @param rule - The parsed rule.
 * @param mimeType - The type to test. An empty type matches only a rule that accepts every file.
 * @returns `true` when the rule accepts every file or a MIME token matches `mimeType`.
 */
export function matchesMimeType(rule: AcceptRule, mimeType: string): boolean {
  if (rule._tag === "any") {
    return true;
  }
  const type = mimeType.toLowerCase();
  if (rule.mimeTypes.has(type)) {
    return true;
  }
  const slash = type.indexOf("/");
  return slash > 0 && rule.topLevelTypes.has(type.slice(0, slash));
}

/**
 * Whether the rule holds an extension token. When it does, a drag's MIME types cannot rule a
 * file out, because only the name it reveals on drop can match.
 *
 * @param rule - The parsed rule.
 * @returns `true` when at least one `.ext` token was parsed.
 */
export function hasExtension(rule: AcceptRule): boolean {
  return rule._tag === "listed" && rule.extensions.length > 0;
}

/**
 * Whether a file passes the rule, through its MIME type or its name.
 *
 * @param rule - The parsed rule.
 * @param file - The file's `name` and `type`.
 * @returns `true` when the rule accepts the file.
 */
export function matchesFile(rule: AcceptRule, file: Pick<File, "name" | "type">): boolean {
  if (rule._tag === "any" || matchesMimeType(rule, file.type)) {
    return true;
  }
  const name = file.name.toLowerCase();
  return rule.extensions.some((extension) => name.endsWith(extension));
}

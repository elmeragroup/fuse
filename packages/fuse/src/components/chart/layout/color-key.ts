/**
 * The per-key colour property of CONTRACT section 11. Fuse never writes `--chart-color-<key>`. Each
 * mark reads it with the config role as the fallback, so a consumer's property on Root wins.
 */

/** Whether a code point stays as it is: an ASCII letter, an ASCII digit or `-`. */
function isKept(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 45
  );
}

/**
 * Turn a config key into a custom-property name fragment. ASCII letters, digits and `-` stay as
 * they are, and every other code point, `_` and non-ASCII letters included, becomes `_`, its code
 * point in lower case hexadecimal, and `_`. Escaping `_` keeps the map one-to-one, so two keys never
 * share a property, and server and client compute the same name.
 *
 * @param key - A config key or a pie category.
 * @returns The fragment, which holds only `[A-Za-z0-9_-]`.
 */
export function escapeColorKey(key: string): string {
  let escaped = "";
  for (const character of key) {
    const code = character.codePointAt(0) ?? 0;
    escaped += isKept(code) ? character : `_${code.toString(16)}_`;
  }
  return escaped;
}

/**
 * The paint a mark reads for one series, `var(--chart-color-<key>, var(--<role>))`.
 *
 * @param key - The config key.
 * @param role - The role CSS variable the config names, such as `chart-1` or `chart-seq-4`.
 * @returns The CSS value.
 */
export function seriesPaint(key: string, role: string): string {
  return `var(--chart-color-${escapeColorKey(key)}, var(--${role}))`;
}

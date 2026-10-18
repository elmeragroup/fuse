/**
 * Class-token readers for the state-face source contracts in `src/source-contracts.test.ts`, which
 * owns the policy. They find a disabled dim or a hover or press face a control writes on itself.
 */
/** The class tokens in source code: every run between whitespace, quotes and backticks. */
function classTokens(code: string): string[] {
  return code.split(/[\s"'`]+/u).filter((token) => token.length > 0);
}

/** Split a class token into its variants and utility at the colons outside brackets. */
function splitVariants(token: string) {
  const variants: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of token) {
    if (character === "[") depth += 1;
    if (character === "]") depth -= 1;
    if (character === ":" && depth === 0) {
      variants.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  return { variants, utility: current };
}

/** A variant that reads another element's state (`group-*`, `peer-*`, `in-*`) styles a part. */
function readsAnotherElement(variant: string): boolean {
  return /^(?:group|peer|in)-/u.test(variant);
}

/**
 * A disabled dim or pointer-events drop the control writes on itself, rather than taking
 * it from the state face.
 */
export function isLocalDisabledDim(token: string): boolean {
  const { variants, utility } = splitVariants(token);
  if (!/^(?:opacity-\d+|pointer-events-none)$/u.test(utility)) return false;
  if (variants.some(readsAnotherElement)) return false;
  return variants.some(
    (variant) =>
      /^(?:disabled|data-disabled|aria-disabled|has-disabled|disabled-state)$/u.test(variant) ||
      (/^(?:data|aria|has)-\[/u.test(variant) && variant.includes("disabled"))
  );
}

/**
 * A `hover:` or `active:` face with no `enabled-*` gate in front of it. A token with no
 * utility after its last colon is an object key such as ScrollArea's `hover:` type, not a class.
 */
export function isUngatedPointerFace(token: string): boolean {
  const { variants, utility } = splitVariants(token);
  return utility.length > 0 && (variants.includes("hover") || variants.includes("active"));
}

const BARE_DISABLED_DIM = /^(?:opacity-\d+|pointer-events-none)$/u;

/**
 * The bare dims a `tv` map writes inside a disabled-named variant arm (`isDisabled: { … }`
 * or `disabled: { … }`). The arm, not a selector, carries the state there, so the dim has
 * no `disabled:` variant for {@link isLocalDisabledDim} to see.
 */
export function disabledArmDims(code: string): string[] {
  const dims: string[] = [];
  for (const match of code.matchAll(/\b(?:isDisabled|disabled)\s*:\s*\{/gu)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let close = open;
    for (; close < code.length; close += 1) {
      if (code[close] === "{") depth += 1;
      if (code[close] === "}") depth -= 1;
      if (depth === 0) break;
    }
    dims.push(...classTokens(code.slice(open + 1, close)).filter((token) => BARE_DISABLED_DIM.test(token)));
  }
  return dims;
}

/**
 * The bare dims a component adds behind a disabled-named prop condition
 * (`isVisuallyDisabled && "opacity-70"` or `isDisabled ? "opacity-50" : …`). The condition,
 * not a selector or a `tv` arm, carries the state there.
 */
export function disabledConditionDims(code: string): string[] {
  const dims: string[] = [];
  for (const match of code.matchAll(/\b\w*[Dd]isabled\w*\s*(?:&&|\?)\s*(["'`])([^"'`]*)\1/gu)) {
    dims.push(...classTokens(match[2] ?? "").filter((token) => BARE_DISABLED_DIM.test(token)));
  }
  return dims;
}

/** Every disabled dim a module writes on itself, by selector, `tv` arm or prop condition. */
export function localDisabledDims(code: string): string[] {
  return [
    ...classTokens(code).filter(isLocalDisabledDim),
    ...disabledArmDims(code),
    ...disabledConditionDims(code),
  ];
}

/** Every hover or press face with no `enabled-*` gate. */
export function ungatedPointerFaces(code: string): string[] {
  return classTokens(code).filter(isUngatedPointerFace);
}

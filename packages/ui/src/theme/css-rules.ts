import type { ThemeInput } from "./tokens/themes";

export type CssDeclaration = {
  name: string;
  value: string;
};

export type CssStyleRule = {
  selector: string;
  declarations: CssDeclaration[];
};

export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

export function cssComments(css: string): string[] {
  return [...css.matchAll(/\/\*[\s\S]*?\*\//g)].map((match) => match[0]);
}

export function parseStyleRules(css: string): CssStyleRule[] {
  const rules: CssStyleRule[] = [];
  const withoutComments = stripCssComments(css);
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = rulePattern.exec(withoutComments);
  while (match) {
    const selector = match[1]?.trim() ?? "";
    const body = match[2] ?? "";
    if (selector !== "" && !selector.startsWith("@")) {
      const declarations: CssDeclaration[] = [];
      for (const chunk of body.split(";")) {
        const trimmed = chunk.trim();
        if (trimmed === "") {
          continue;
        }
        const colon = trimmed.indexOf(":");
        if (colon === -1) {
          continue;
        }
        const rawName = trimmed.slice(0, colon).trim();
        const value = trimmed.slice(colon + 1).trim();
        const name = rawName.startsWith("--") ? rawName.slice(2) : rawName;
        declarations.push({ name, value });
      }
      rules.push({ selector, declarations });
    }
    match = rulePattern.exec(withoutComments);
  }
  return rules;
}

export function selectorMatchesTheme(selector: string, theme: ThemeInput): boolean {
  if (selector === ":root") {
    return true;
  }
  const attrs = {
    "data-theme-variant": theme.variant,
    "data-theme-brand": theme.brand,
    "data-theme-segment": theme.segment,
  };
  const parts = [...selector.matchAll(/\[([a-z-]+)="([^"]+)"\]/g)];
  if (parts.length === 0) {
    return false;
  }
  return parts.every((part) => {
    const attr = part[1];
    const value = part[2];
    if (attr === undefined || value === undefined) {
      return false;
    }
    if (attr === "data-theme-variant") {
      return attrs["data-theme-variant"] === value;
    }
    if (attr === "data-theme-brand") {
      return attrs["data-theme-brand"] === value;
    }
    if (attr === "data-theme-segment") {
      return attrs["data-theme-segment"] === value;
    }
    return false;
  });
}

export function applyMatchingRules(
  rules: readonly CssStyleRule[],
  theme: ThemeInput,
  initial: ReadonlyMap<string, string>,
  includeRoot: boolean
): Map<string, string> {
  const next = new Map(initial);
  for (const rule of rules) {
    if (rule.selector === ":root") {
      if (includeRoot) {
        for (const declaration of rule.declarations) {
          next.set(declaration.name, declaration.value);
        }
      }
      continue;
    }
    if (!selectorMatchesTheme(rule.selector, theme)) {
      continue;
    }
    for (const declaration of rule.declarations) {
      next.set(declaration.name, declaration.value);
    }
  }
  return next;
}

export function computeThemeDeclarations(
  rules: readonly CssStyleRule[],
  theme: ThemeInput
): Map<string, string> {
  return applyMatchingRules(rules, theme, new Map(), true);
}

export function computeNestedThemeDeclarations(
  rules: readonly CssStyleRule[],
  outer: ThemeInput,
  inner: ThemeInput
): Map<string, string> {
  const inherited = computeThemeDeclarations(rules, outer);
  return applyMatchingRules(rules, inner, inherited, false);
}

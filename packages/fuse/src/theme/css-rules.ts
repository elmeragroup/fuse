export type CssDeclaration = {
  name: string;
  value: string;
};

export type CssStyleRule = {
  selector: string;
  declarations: CssDeclaration[];
};

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
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

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BESPOKE_ICON_NAMES, LOGO_NAMES, PHOSPHOR_ICON_NAMES } from "./roster";
import type { PhosphorIconName } from "./roster";

const GENERATED_FILE_HEADER = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 *
 * Generated from the curated Phosphor roster in roster.ts.
 */

`;

export function iconModuleSlug(name: string): string {
  let slug = "";
  let index = 0;
  for (const letter of name) {
    const isUpper = letter >= "A" && letter <= "Z";
    const next = isUpper ? letter.toLowerCase() : letter;
    slug += index > 0 && isUpper ? `-${next}` : next;
    index += 1;
  }
  return slug;
}

export function generatedAdapterSource(name: PhosphorIconName): string {
  return `${GENERATED_FILE_HEADER}import { ${name} as Phosphor${name} } from "@phosphor-icons/react/dist/ssr/${name}";

import { createElmeraIcon } from "../create-elmera-icon";

export const ${name} = createElmeraIcon(Phosphor${name}, "${name}");
`;
}

export function generatedFacadeSource(names: readonly PhosphorIconName[]): string {
  const iconExports = names
    .map((name) => `export { ${name} } from "./icons/generated/${iconModuleSlug(name)}";`)
    .join("\n");
  const bespokeExports = BESPOKE_ICON_NAMES.map(
    (name) => `export { ${name} } from "./icons/bespoke/${iconModuleSlug(name)}";`
  ).join("\n");
  const logoExports = LOGO_NAMES.map(
    (name) => `export { ${name} } from "./icons/bespoke/${iconModuleSlug(name)}";`
  ).join("\n");
  return `${GENERATED_FILE_HEADER}export type { ElmeraIconProps } from "./icons/create-elmera-icon";
${iconExports}
${bespokeExports}
export type { BespokeSvgProps, LogoProps } from "./icons/bespoke-svg";
${logoExports}
export type { BrandLogoProps } from "./icons/brand-logo";
export { BrandLogo } from "./icons/brand-logo";
`;
}

export function writeGeneratedIcons(packageRoot: string): void {
  const generatedDir = join(packageRoot, "src/icons/generated");
  mkdirSync(generatedDir, { recursive: true });

  const expected = new Set<string>();
  for (const name of PHOSPHOR_ICON_NAMES) {
    const fileName = `${iconModuleSlug(name)}.ts`;
    expected.add(fileName);
    writeFileSync(join(generatedDir, fileName), generatedAdapterSource(name));
  }

  for (const existing of readdirSync(generatedDir)) {
    if (!expected.has(existing)) {
      rmSync(join(generatedDir, existing));
    }
  }

  writeFileSync(join(packageRoot, "src/icons.ts"), generatedFacadeSource(PHOSPHOR_ICON_NAMES));
}

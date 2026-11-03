import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { BRANDS } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { BrandMark } from "../../../brand/brand-mark";
import { useCopy } from "../../../copy/copy";
import { SceneTheme } from "../../../primitives/scene-theme";

/**
 * A brand poster, the template's terracotta plate in a brand's primary role: a label, a line in
 * the heading face and the brand's mark in the corner.
 *
 * @param props.brand - The brand whose primary fills the poster.
 * @param props.version - The release the label names.
 * @param props.line - Which line the poster carries.
 * @returns The poster, filling its slot.
 */
export function HeadlinePoster({
  brand,
  version,
  line,
}: {
  readonly brand: BrandCode;
  readonly version: string;
  readonly line: "components" | "roles";
}): ReactElement {
  const { collage } = useCopy().brandBook;
  return (
    <SceneTheme
      brand={brand}
      scheme="light"
      className="relative flex size-full flex-col gap-4 bg-primary p-6 font-sans text-primary-foreground">
      <span className="text-xs">{collage.posterLabel(version)}</span>
      <p className="font-medium m-0 max-w-60 font-heading text-[30px] leading-[1.05] tracking-[-0.03em]">
        {line === "components" ? collage.posterTitle : collage.rolesTitle}
      </p>
      <BrandMark brand={brand} className="absolute right-6 bottom-6 h-7" />
    </SceneTheme>
  );
}

/**
 * A mark poster, the template's graphite plate: the brand's mark in its own colours on the brand's
 * colour, captioned with its name.
 *
 * @param props.brand - The brand.
 * @returns The poster, filling its slot.
 */
export function MarkPoster({ brand }: { readonly brand: BrandCode }): ReactElement {
  return (
    <SceneTheme
      brand={brand}
      scheme="dark"
      className="relative flex size-full items-center justify-center bg-brand font-sans text-brand-foreground">
      <BrandMark brand={brand} ink="artwork" className="h-20" />
      <span className="text-xs absolute bottom-5 left-6">{BRANDS[brand].displayName}</span>
    </SceneTheme>
  );
}

/** The roles a swatch poster shows, in the order the palette scene names them. */
const SWATCH_ROLES = ["primary", "secondary", "feature", "primary-soft"] as const;

/** One swatch on a poster, filled with its role; the template rounds the second into a dot. */
const swatch = tv({
  base: "size-11",
  variants: {
    role: {
      primary: "bg-primary",
      secondary: "bg-secondary",
      feature: "bg-feature",
      "primary-soft": "bg-primary-soft",
    } satisfies Record<(typeof SWATCH_ROLES)[number], string>,
    round: { true: "rounded-full" },
  },
});

/**
 * A swatch poster, the template's stone plate: the brand's name in the heading face over its first
 * four colour roles, each a swatch, with the roles' line underneath.
 *
 * @param props.brand - The brand.
 * @returns The poster, filling its slot.
 */
export function SwatchPoster({ brand }: { readonly brand: BrandCode }): ReactElement {
  const { collage } = useCopy().brandBook;
  return (
    <SceneTheme
      brand={brand}
      scheme="light"
      className="relative flex size-full flex-col gap-6 bg-card p-6 font-sans text-card-foreground">
      <p className="font-semibold m-0 font-heading text-[30px] leading-none tracking-[-0.03em]">
        {BRANDS[brand].displayName}
      </p>
      <div className="flex gap-2">
        {SWATCH_ROLES.map((role, index) => (
          <span key={role} className={swatch({ role, round: index === 1 })} />
        ))}
      </div>
      <span className="text-xs absolute bottom-5 left-6 text-muted-foreground">{collage.rolesTitle}</span>
    </SceneTheme>
  );
}

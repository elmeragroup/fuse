/**
 * The shape of the deck manifest the bundler generates as `virtual:fuse-deck`
 * (`src/bundler/bundler.ts`). `virtual-manifest.d.ts` declares that module with this type.
 */

import type { ComponentType } from "react";

import type { LayoutName } from "../deck/vocabulary.ts";

/** The components MDX looks up for JSX names a slide did not import. */
export type MdxComponents = Readonly<Record<string, ComponentType<never>>>;

/** One slide's entry: what the compile derived and an import of its module. */
export type ManifestSlide = {
  readonly id: string;
  readonly title: string | null;
  readonly layout: LayoutName;
  readonly steps: number;
  readonly load: () => Promise<{ readonly default: ComponentType<{ readonly components: MdxComponents }> }>;
};

/** The deck's settings and its slides in order. */
export type DeckManifest = {
  readonly title: string;
  readonly aspect: "16:9" | "4:3";
  readonly slides: readonly ManifestSlide[];
};

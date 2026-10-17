import type { ReactElement } from "react";

import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { tv } from "tailwind-variants";

import { BRANDS } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

import { roleHex } from "../../brand/role-value";
import { ValueSwap } from "../../components/remocn/value-swap";
import { useCopy } from "../../copy/copy";
import { CLAMP, EXIT } from "../../motion/easing";
import { bars, beats } from "../../music/beat-grid";
import { Rise } from "../../primitives/rise";
import { SceneFrame } from "../../primitives/scene-frame";
import { SceneTheme } from "../../primitives/scene-theme";
import { push } from "../motion";
import { RESOLVES, SpecimenStage } from "./anatomy/specimen";
import type { SpecimenRole } from "./anatomy/specimen";

/** One quick cut: the theme the whole page takes and the bar it cuts on. */
type Cut = {
  readonly brand: BrandCode;
  readonly scheme: ResolvedColorScheme;
  readonly bar: number;
};

/**
 * The template's style cuts, as themes: Elmera holds while the roles resolve, then every brand
 * takes the page in turn, light and dark alternating, the cuts quickening up the drop's build.
 */
const CUTS: readonly [Cut, ...Cut[]] = [
  { brand: "elma", scheme: "light", bar: 0 },
  { brand: "fkas", scheme: "light", bar: 4 },
  { brand: "tkas", scheme: "dark", bar: 5 },
  { brand: "guen", scheme: "light", bar: 5.5 },
  { brand: "fkab", scheme: "dark", bar: 6 },
  { brand: "fkse", scheme: "light", bar: 6.5 },
  { brand: "ngfi", scheme: "dark", bar: 7 },
  { brand: "elma", scheme: "light", bar: 7.5 },
];

/** The cut on screen at a frame. */
function cutAt(frame: number): Cut {
  return CUTS.findLast((cut) => bars(cut.bar) <= frame) ?? CUTS[0];
}

/** The swatch each legend row shows, in its role. */
const swatch = tv({
  base: "size-5 shrink-0 rounded-sm border border-border",
  variants: {
    role: {
      card: "bg-card",
      foreground: "bg-foreground",
      input: "bg-input",
      primary: "bg-primary",
      "success-soft": "bg-success-soft",
    } satisfies Record<SpecimenRole, string>,
  },
});

function AnatomyPage(): ReactElement {
  const { anatomy, schemes } = useCopy().brandBook;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const cut = cutAt(frame);
  // The last bar pulls the page back and softens it into the collage's paper.
  const exitAt = durationInFrames - bars(1);
  const leaving = interpolate(frame, [exitAt, durationInFrames], [0, 1], { ...CLAMP, easing: EXIT });
  const guides =
    push(frame, 0, beats(3)) * (1 - interpolate(frame, [exitAt - beats(2), exitAt], [0, 1], CLAMP));
  const themeNames = CUTS.map(({ brand, scheme }) => `${BRANDS[brand].displayName} · ${schemes[scheme]}`);
  const cutFrames = CUTS.slice(1).map(({ bar }) => bars(bar));

  return (
    <SceneTheme
      brand={cut.brand}
      scheme={cut.scheme}
      className="relative size-full overflow-hidden bg-background font-sans text-foreground">
      <div
        className="absolute inset-0"
        style={{
          opacity: 1 - leaving,
          scale: String(1 - leaving * 0.06),
          filter: `blur(${String(leaving * 10)}px)`,
        }}>
        <div className="text-xl absolute inset-x-0 top-8 flex flex-col items-center gap-1 text-center">
          <Rise at={0}>
            <span>{anatomy.title}</span>
          </Rise>
          <Rise at={bars(4)}>
            <span className="text-muted-foreground">{anatomy.subtitle}</span>
          </Rise>
        </div>
        <SpecimenStage frame={frame} guides={guides} />
        <ul className="text-lg absolute top-0 right-20 m-0 flex h-full list-none flex-col justify-center gap-5 p-0 font-mono">
          {RESOLVES.map(({ role, beat }) => (
            <li key={role}>
              <Rise at={beats(beat)} distance={10} className="flex items-center gap-4">
                <span className={swatch({ role })} />
                <span className="w-36">{role}</span>
                <ValueSwap
                  className="text-muted-foreground"
                  values={CUTS.map((theme) => roleHex(theme, role))}
                  at={cutFrames}
                  duration={6}
                  distance={8}
                />
              </Rise>
            </li>
          ))}
        </ul>
        <Rise
          at={beats(2)}
          className="text-base absolute inset-x-0 bottom-10 flex justify-center text-muted-foreground">
          <ValueSwap values={themeNames} at={cutFrames} duration={6} distance={8} />
        </Rise>
      </div>
    </SceneTheme>
  );
}

function AnatomySceneInner(): ReactElement {
  return (
    <SceneFrame>
      <AnatomyPage />
    </SceneFrame>
  );
}

/**
 * Scene 3: the anatomy, in place of the template's type specimen. A card of Fuse parts starts as a
 * grey drawing and takes Elmera's theme one role at a time, each role framed as it lands; then the
 * whole page cuts through every brand, light and dark, while the legend's values change under the
 * same role names.
 */
export const AnatomyScene = Interactive.withSchema({
  Component: AnatomySceneInner,
  componentName: "AnatomyScene",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});

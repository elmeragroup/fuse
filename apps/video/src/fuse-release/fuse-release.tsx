import type { ReactElement } from "react";

import { Track } from "remotion";

import { VideoLocaleContext } from "../copy/copy";
import { Soundtrack } from "../music/soundtrack";
import type { FilmProps } from "../music/soundtrack";
import { MUSIC_EDIT, sceneFrames } from "./grid";
import { BrandMorphScene } from "./scenes/brand-morph-scene";
import { DensityScene } from "./scenes/density-scene";
import { HeroScene } from "./scenes/hero-scene";
import { InstallScene } from "./scenes/install-scene";
import { LockupScene } from "./scenes/lockup-scene";
import { MontageScene } from "./scenes/montage-scene";

/**
 * The Fuse release video. One composition per locale renders it; the version is a prop, so the
 * same cut announces later releases. Scenes sit on the beat grid and cut on downbeats.
 *
 * @returns The video.
 */
export function FuseRelease({ locale, version, music }: FilmProps): ReactElement {
  return (
    <VideoLocaleContext value={locale}>
      <Track name="Scenes">
        <HeroScene name="Hero" {...sceneFrames("hero")} />
        <BrandMorphScene name="Brand morph" {...sceneFrames("brandMorph")} />
        <DensityScene name="Internal vs External" {...sceneFrames("density")} />
        <MontageScene name="Component montage" {...sceneFrames("montage")} />
        <InstallScene name="Install" {...sceneFrames("install")} />
        <LockupScene name="Lockup" version={version} {...sceneFrames("lockup")} />
      </Track>
      {music ? <Soundtrack edit={MUSIC_EDIT} /> : null}
    </VideoLocaleContext>
  );
}

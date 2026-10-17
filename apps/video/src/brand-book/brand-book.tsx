import type { ReactElement } from "react";

import { Track } from "remotion";

import { VideoLocaleContext } from "../copy/copy";
import { Soundtrack } from "../music/soundtrack";
import type { FilmProps } from "../music/soundtrack";
import { MUSIC_EDIT, sceneFrames } from "./grid";
import { AnatomyScene } from "./scenes/anatomy-scene";
import { ClosingScene } from "./scenes/closing-scene";
import { CollageScene } from "./scenes/collage-scene";
import { IdentityScene } from "./scenes/identity-scene";
import { PaletteScene } from "./scenes/palette-scene";

/**
 * The Fuse brand book: remocn's Brand Guidelines identity film retold for Fuse. The Elmera mark
 * opens into the brands' role colours, a card of Fuse parts resolves role by role and cuts through
 * every brand, a collage of live parts travels on the track's drop, and three flipping tiles close
 * on the Fuse lockup. Scenes sit on the beat grid and cut on downbeats.
 *
 * @returns The film.
 */
export function BrandBook({ locale, version, music }: FilmProps): ReactElement {
  return (
    <VideoLocaleContext value={locale}>
      <Track name="Scenes">
        <IdentityScene name="Identity" {...sceneFrames("identity")} />
        <PaletteScene name="Palette" {...sceneFrames("palette")} />
        <AnatomyScene name="Anatomy" {...sceneFrames("anatomy")} />
        <CollageScene name="Collage" version={version} {...sceneFrames("collage")} />
        <ClosingScene name="Closing" version={version} {...sceneFrames("closing")} />
      </Track>
      {music ? <Soundtrack edit={MUSIC_EDIT} /> : null}
    </VideoLocaleContext>
  );
}

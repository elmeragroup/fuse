import type { ReactElement } from "react";

import { Composition, Folder } from "remotion";

import { BrandBook } from "./brand-book/brand-book";
import {
  BRAND_BOOK_FRAMES,
  sceneFrames as brandBookScene,
  MUSIC_EDIT as BRAND_BOOK_EDIT,
} from "./brand-book/grid";
import { AnatomyScene } from "./brand-book/scenes/anatomy-scene";
import { ClosingScene } from "./brand-book/scenes/closing-scene";
import { CollageScene } from "./brand-book/scenes/collage-scene";
import { IdentityScene } from "./brand-book/scenes/identity-scene";
import { PaletteScene } from "./brand-book/scenes/palette-scene";
import { DEFAULT_VERSION } from "./brand/fuse-facts";
import { ClaudeBuilds } from "./claude-builds/claude-builds";
import {
  CLAUDE_BUILDS_FRAMES,
  sceneFrames as claudeBuildsScene,
  MUSIC_EDIT as CLAUDE_BUILDS_EDIT,
} from "./claude-builds/grid";
import { LockupScene as ClaudeBuildsLockupScene } from "./claude-builds/lockup-scene";
import { SessionScene } from "./claude-builds/session-scene";
import { VIDEO_LOCALES } from "./copy/catalog";
import { FuseRelease } from "./fuse-release/fuse-release";
import { FUSE_RELEASE_FRAMES, sceneFrames, MUSIC_EDIT as FUSE_RELEASE_EDIT } from "./fuse-release/grid";
import { BrandMorphScene } from "./fuse-release/scenes/brand-morph-scene";
import { DensityScene } from "./fuse-release/scenes/density-scene";
import { HeroScene } from "./fuse-release/scenes/hero-scene";
import { InstallScene } from "./fuse-release/scenes/install-scene";
import { LockupScene } from "./fuse-release/scenes/lockup-scene";
import { MontageScene } from "./fuse-release/scenes/montage-scene";
import "./index.css";
import { FPS } from "./music/beat-grid";
import { soundtrackMetadata } from "./music/soundtrack";

/** Every composition's format: 16:9 at 1080p, on the cut's frame rate. */
const VIDEO_FORMAT = { fps: FPS, width: 1920, height: 1080 } as const;

/** Each film's metadata function, built once so every locale's composition shares it. */
const METADATA = {
  fuseRelease: soundtrackMetadata(FUSE_RELEASE_EDIT),
  claudeBuilds: soundtrackMetadata(CLAUDE_BUILDS_EDIT),
  brandBook: soundtrackMetadata(BRAND_BOOK_EDIT),
} as const;

/**
 * Every composition: each film once per locale, and each of its scenes as a connected composition
 * that opens on its own timeline in Studio, in English.
 *
 * @returns The registrations.
 */
export function RemotionRoot(): ReactElement {
  return (
    <>
      {VIDEO_LOCALES.map((locale) => (
        <Composition
          key={locale}
          id={`FuseRelease-${locale}`}
          component={FuseRelease}
          durationInFrames={FUSE_RELEASE_FRAMES}
          {...VIDEO_FORMAT}
          defaultProps={{ locale, version: DEFAULT_VERSION, music: false }}
          calculateMetadata={METADATA.fuseRelease}
        />
      ))}
      <Folder name="Scenes">
        <Composition
          id="Hero"
          component={HeroScene}
          durationInFrames={sceneFrames("hero").durationInFrames}
          {...VIDEO_FORMAT}
        />
        <Composition
          id="BrandMorph"
          component={BrandMorphScene}
          durationInFrames={sceneFrames("brandMorph").durationInFrames}
          {...VIDEO_FORMAT}
        />
        <Composition
          id="InternalVsExternal"
          component={DensityScene}
          durationInFrames={sceneFrames("density").durationInFrames}
          {...VIDEO_FORMAT}
        />
        <Composition
          id="ComponentMontage"
          component={MontageScene}
          durationInFrames={sceneFrames("montage").durationInFrames}
          {...VIDEO_FORMAT}
        />
        <Composition
          id="Install"
          component={InstallScene}
          durationInFrames={sceneFrames("install").durationInFrames}
          {...VIDEO_FORMAT}
        />
        <Composition
          id="Lockup"
          component={LockupScene}
          durationInFrames={sceneFrames("lockup").durationInFrames}
          {...VIDEO_FORMAT}
          defaultProps={{ version: DEFAULT_VERSION }}
        />
      </Folder>
      <Folder name="ClaudeBuilds">
        {VIDEO_LOCALES.map((locale) => (
          <Composition
            key={locale}
            id={`ClaudeBuilds-${locale}`}
            component={ClaudeBuilds}
            durationInFrames={CLAUDE_BUILDS_FRAMES}
            {...VIDEO_FORMAT}
            defaultProps={{ locale, version: DEFAULT_VERSION, music: false }}
            calculateMetadata={METADATA.claudeBuilds}
          />
        ))}
        <Composition
          id="ClaudeBuildsSession"
          component={SessionScene}
          durationInFrames={claudeBuildsScene("session").durationInFrames}
          {...VIDEO_FORMAT}
        />
        <Composition
          id="ClaudeBuildsLockup"
          component={ClaudeBuildsLockupScene}
          durationInFrames={claudeBuildsScene("lockup").durationInFrames}
          {...VIDEO_FORMAT}
          defaultProps={{ version: DEFAULT_VERSION }}
        />
      </Folder>
      <Folder name="BrandBook">
        {VIDEO_LOCALES.map((locale) => (
          <Composition
            key={locale}
            id={`BrandBook-${locale}`}
            component={BrandBook}
            durationInFrames={BRAND_BOOK_FRAMES}
            {...VIDEO_FORMAT}
            defaultProps={{ locale, version: DEFAULT_VERSION, music: false }}
            calculateMetadata={METADATA.brandBook}
          />
        ))}
        <Composition
          id="BrandBookIdentity"
          component={IdentityScene}
          durationInFrames={brandBookScene("identity").durationInFrames}
          {...VIDEO_FORMAT}
        />
        <Composition
          id="BrandBookPalette"
          component={PaletteScene}
          durationInFrames={brandBookScene("palette").durationInFrames}
          {...VIDEO_FORMAT}
        />
        <Composition
          id="BrandBookAnatomy"
          component={AnatomyScene}
          durationInFrames={brandBookScene("anatomy").durationInFrames}
          {...VIDEO_FORMAT}
        />
        <Composition
          id="BrandBookCollage"
          component={CollageScene}
          durationInFrames={brandBookScene("collage").durationInFrames}
          {...VIDEO_FORMAT}
          defaultProps={{ version: DEFAULT_VERSION }}
        />
        <Composition
          id="BrandBookClosing"
          component={ClosingScene}
          durationInFrames={brandBookScene("closing").durationInFrames}
          {...VIDEO_FORMAT}
          defaultProps={{ version: DEFAULT_VERSION }}
        />
      </Folder>
    </>
  );
}

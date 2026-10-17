import type { ReactElement } from "react";

import { Track } from "remotion";

import { VideoLocaleContext } from "../copy/copy";
import { Soundtrack } from "../music/soundtrack";
import type { FilmProps } from "../music/soundtrack";
import { MUSIC_EDIT, sceneFrames } from "./grid";
import { LockupScene } from "./lockup-scene";
import { SessionScene } from "./session-scene";

/**
 * "Claude builds it": Claude Code takes a casual prompt for a component library that supports
 * every brand, answers that it will follow the seam, installs Fuse and builds a public site with
 * it section by section, then flips the page through every brand, light and dark, into the
 * track's drop, and signs off before the lockup.
 *
 * @returns The film.
 */
export function ClaudeBuilds({ locale, version, music }: FilmProps): ReactElement {
  return (
    <VideoLocaleContext value={locale}>
      <Track name="Scenes">
        <SessionScene name="Session" {...sceneFrames("session")} />
        <LockupScene name="Lockup" version={version} {...sceneFrames("lockup")} />
      </Track>
      {music ? <Soundtrack edit={MUSIC_EDIT} /> : null}
    </VideoLocaleContext>
  );
}

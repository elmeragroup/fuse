import type { ReactElement } from "react";

import { Audio } from "@remotion/media";
import type { CalculateMetadataFunction } from "remotion";
import { staticFile } from "remotion";

import type { VideoLocale } from "../copy/catalog";
import type { MusicEdit } from "./music-edit";

/**
 * Every film's props: the locale it renders in, the version it announces and whether it plays
 * its music, which {@link soundtrackMetadata} decides.
 */
export type FilmProps = {
  readonly locale: VideoLocale;
  readonly version: string;
  readonly music: boolean;
};

/** The cuts this page has logged a missing-cut warning for. */
const warned = new Set<string>();

/**
 * Looks for a film's music cut before the film mounts its audio, because a render fails on an
 * audio source that answers 404. Without the file the film plays silent and logs one warning.
 *
 * @param edit - The film's music edit, which names its cut.
 * @returns Whether the cut is in `public/music/local/`.
 */
async function findSoundtrack(edit: MusicEdit): Promise<boolean> {
  const response = await fetch(staticFile(edit.file), { method: "HEAD" });
  if (!response.ok && !warned.has(edit.file)) {
    warned.add(edit.file);
    console.warn(
      `The video plays silent: public/${edit.file} is missing. Download the track and run \`pnpm --filter video music:cut\`, as apps/video/AGENTS.md describes.`
    );
  }
  return response.ok;
}

/**
 * Plays a film's music only when its cut is there. The licensed track is git-ignored, so a fresh
 * clone renders silent instead of failing on the missing file.
 *
 * @param edit - The film's music edit, which names its cut.
 * @returns The film's metadata function, which sets `music`.
 */
export function soundtrackMetadata(edit: MusicEdit): CalculateMetadataFunction<FilmProps> {
  return async ({ props }) => ({ props: { ...props, music: await findSoundtrack(edit) } });
}

/**
 * A film's music: "Edge of the World" by OceanKing, under the Pixabay Content License, edited by
 * `scripts/cut-music.ts` into one file that starts on the film's first frame. Its splices and
 * fades are in the samples, so it plays at constant gain; Remotion applies a volume callback once
 * per video frame, which steps a fade and clicks.
 *
 * @param props.edit - The film's music edit, which names its cut.
 * @returns The audio track.
 */
export function Soundtrack({ edit }: { readonly edit: MusicEdit }): ReactElement {
  return <Audio name="Edge of the World" src={staticFile(edit.file)} />;
}

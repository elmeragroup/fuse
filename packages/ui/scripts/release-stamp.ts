/**
 * The release identity the pack adapter writes into the publish manifest after the ordinary
 * package build. The engine reads it back from the registry to identify what a version was
 * built from (`elmeraRelease` in `dist/package.json`, release.md §5).
 *
 * `scripts/publish-release.ts`'s `PackAndVerify` assignment structurally checks this type
 * against the engine's release intent, which is the contract that keeps it honest.
 */
export type ReleaseStamp = {
  version: string;
  commit: string;
  channel: "canary" | "stable";
};

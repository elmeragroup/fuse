/**
 * The release identity the pack adapter hands to the package build through the environment.
 * The build stamps it into the publish manifest's `elmeraRelease` field, which the release
 * engine reads back from the registry to identify what a version was built from (release.md §5).
 */
export type ReleaseStamp = {
  version: string;
  commit: string;
  channel: "canary" | "stable";
};

export const RELEASE_VERSION_ENV = "ELMERA_RELEASE_VERSION";
export const RELEASE_COMMIT_ENV = "ELMERA_RELEASE_COMMIT";
export const RELEASE_CHANNEL_ENV = "ELMERA_RELEASE_CHANNEL";

/**
 * Parses the release stamp from a build environment. No variables means an ordinary
 * workspace build; a partial or unknown stamp is a misconfiguration, not a default.
 */
export function releaseStampFromEnv(env: NodeJS.ProcessEnv): ReleaseStamp | undefined {
  const version = env[RELEASE_VERSION_ENV];
  const commit = env[RELEASE_COMMIT_ENV];
  const channel = env[RELEASE_CHANNEL_ENV];
  if (version === undefined && commit === undefined && channel === undefined) {
    return undefined;
  }
  if (version === undefined || version.length === 0 || commit === undefined || commit.length === 0) {
    throw new Error(
      `Release stamp is incomplete: ${RELEASE_VERSION_ENV} and ${RELEASE_COMMIT_ENV} must both be set`
    );
  }
  if (channel !== "canary" && channel !== "stable") {
    throw new Error(`${RELEASE_CHANNEL_ENV} must be "canary" or "stable", got ${String(channel)}`);
  }
  return { version, commit, channel };
}

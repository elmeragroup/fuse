/**
 * The studio's one size policy. The knobs refuse a value over the value limit, and the share
 * codec writes and reads nothing over either limit, so a session the studio accepts is a session
 * a share link or the autosave can carry back.
 */

/** The longest single token value, in characters. */
export const MAX_VALUE_LENGTH = 256;

/** The longest share text, in characters: the version, the dot and the base64url payload. */
export const MAX_SHARE_LENGTH = 8192;

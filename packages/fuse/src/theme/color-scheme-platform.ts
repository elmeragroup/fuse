import type { ColorScheme, ResolvedColorScheme } from "./color-scheme-types";

/** How a root write treats CSS transitions: `undefined` lets them run. */
export type ColorSchemeTransition = { readonly nonce: string | undefined } | undefined;

/**
 * What the color-scheme runtime needs from a document: the root `data-theme` attribute, one
 * storage area and the `(prefers-color-scheme: dark)` query, the same three channels the
 * pre-hydration bootstrap touches.
 *
 * Adapter obligations the runtime relies on:
 * - Totality: no member throws. An unreachable platform looks empty: `read` is `null`,
 *   `matches` is `false` and `subscribe` returns a no-op. The runtime therefore has no
 *   try/catch.
 * - Synchrony: `root.write` has taken effect when it returns.
 * - No self-echo: `storage.subscribe` never reports this document's own `write`.
 * - Laziness: constructing an adapter reads no globals, so a server render stays inert.
 *
 * Free of React and DOM types on purpose, so the runtime has no platform dependency.
 */
export type ColorSchemePlatform = {
  /** The document root's `data-theme` attribute. */
  readonly root: {
    /** The raw attribute, or `null` when it is absent or the root is unreachable. */
    read(): string | null;
    /** Sets the attribute synchronously; with a transition, CSS transitions cannot animate it. */
    write(value: ResolvedColorScheme, transition: ColorSchemeTransition): void;
  };
  /** The persistent storage area that holds the preference (local storage in a browser). */
  readonly storage: {
    /** The stored string, or `null` when it is absent, blocked or unreadable. */
    read(key: string): string | null;
    /** Best effort: a quota or security failure is swallowed. */
    write(key: string, value: ColorScheme): void;
    /**
     * Calls `onChange(newValue)` when another document changes `key` in this same area, and
     * with `null` for a whole-area clear. Returns an idempotent unsubscribe.
     */
    subscribe(key: string, onChange: (newValue: string | null) => void): () => void;
  };
  /** The `(prefers-color-scheme: dark)` media query. */
  readonly media: {
    /** Whether the query matches, or `false` when the platform cannot evaluate it. */
    matches(): boolean;
    /** Calls `onChange` when the match may have flipped. Returns an idempotent unsubscribe. */
    subscribe(onChange: () => void): () => void;
  };
};

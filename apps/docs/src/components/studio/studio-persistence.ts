"use client";

import { useEffect, useRef } from "react";

import { usePathname } from "next/navigation";

import { Toast } from "@elmeragroup/fuse/toast";

import type { EditAction, StudioDocument } from "../../lib/studio/edits";
import { NO_OVERRIDES } from "../../lib/studio/edits";
import { decodeShare, encodeShare } from "../../lib/studio/share-codec";
import type { ShareEncoding } from "../../lib/studio/share-codec";

/** The studio's one autosave key, versioned with the share format it holds. */
const AUTOSAVE_KEY = "fuse-studio-v1";

/** How long the hash and the autosave wait for edits to settle before they are written. */
const WRITE_DELAY_MS = 300;

/**
 * How long the hash follows the address after a navigation. The router writes its own history
 * entry in a later commit, which drops the hash or brings back an older one.
 */
const FOLLOW_MS = 1000;

/**
 * The studio's toasts. A module manager, so the persistence effects can toast before the
 * provider's viewport mounts; it queues the calls and replays them once it connects.
 */
export const studioToasts = Toast.createToastManager();

function readAutosave(): string | null {
  try {
    return window.localStorage.getItem(AUTOSAVE_KEY);
  } catch {
    return null;
  }
}

function writeAutosave(text: string | undefined): void {
  try {
    if (text === undefined) {
      window.localStorage.removeItem(AUTOSAVE_KEY);
    } else {
      window.localStorage.setItem(AUTOSAVE_KEY, text);
    }
  } catch {
    // Storage may be full, blocked or absent; the share link still carries the edits.
  }
}

/** Tells the visitor why a session has no share text: the encoder refused it. */
export function toastUnshareable(reason: Extract<ShareEncoding, { ok: false }>["reason"]): void {
  studioToasts.add({
    type: "warning",
    title: reason === "too-large" ? "Too many edits to share" : "An edit cannot be shared",
    description:
      "The link and the saved session keep your last edits that fit. Reset some edits to share again.",
  });
}

/** Makes `text` the address's hash, or drops the hash when `text` is undefined, unless it already is. */
function writeHash(text: string | undefined): void {
  if (window.location.hash.slice(1) === (text ?? "")) {
    return;
  }
  const url = new URL(window.location.href);
  url.hash = text ?? "";
  window.history.replaceState(null, "", text === undefined ? `${url.pathname}${url.search}` : url);
}

function isPristine(document: StudioDocument, opening: StudioDocument): boolean {
  return document.theme === opening.theme && document.overrides === NO_OVERRIDES;
}

/**
 * Restores the edit session once on mount and keeps it saved. The URL hash wins over the
 * autosave. Text in either that the share codec cannot read is ignored with a toast, never a
 * crash. Each settled change rewrites the hash with `history.replaceState`, so the share link is
 * always the address, and the autosave with the same text. A pristine session clears both. A
 * session the share codec refuses, such as one too large to share, writes neither: both keep the
 * last good text, and a toast says so once until the session fits again.
 *
 * The session outlives the page, but a page link drops the hash, and Back or Forward brings back
 * the hash of an older entry. This hook remembers the last text it wrote, and after every
 * navigation it writes that text back wherever the address differs, or drops the hash once the
 * session is pristine. One owner covers every link: the Pages list, the phone's Sheet and the ⌘K
 * palette. A navigation shows as a new pathname, a Navigation API entry change, a `popstate`, or
 * a link click, which covers a click on the current page's row in browsers without that API.
 *
 * @param document - The session's current document.
 * @param opening - The document the session opens with before anything is restored.
 * @param dispatch - Loads a restored document into the session.
 */
export function useStudioPersistence(
  document: StudioDocument,
  opening: StudioDocument,
  dispatch: (action: EditAction) => void
): void {
  const restored = useRef(false);
  const refused = useRef(false);
  // The share text the address carries: the last text written, or the one the session opened from.
  const shared = useRef<string | undefined>(undefined);
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    let loaded: StudioDocument | undefined;
    if (hash !== "") {
      loaded = decodeShare(hash);
      if (loaded === undefined) {
        studioToasts.add({
          type: "warning",
          title: "The link's edits could not be read",
          description: "It may be damaged or from an older studio. The studio opened without them.",
        });
      }
    }
    if (loaded === undefined) {
      const saved = readAutosave();
      if (saved !== null) {
        loaded = decodeShare(saved);
        if (loaded === undefined) {
          studioToasts.add({
            type: "warning",
            title: "Your saved edits could not be read",
            description: "They may be from an older studio. The studio opened without them.",
          });
        }
      }
    }
    if (loaded !== undefined) {
      dispatch({ type: "replace", document: loaded });
    }
    // An opening hash stays on the address until the first write; one that could not be read goes.
    shared.current = hash !== "" && loaded !== undefined ? hash : undefined;
    restored.current = true;
  }, [dispatch]);

  useEffect(() => {
    if (!restored.current) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const encoded = isPristine(document, opening) ? undefined : encodeShare(document);
      if (encoded !== undefined && !encoded.ok) {
        if (!refused.current) {
          toastUnshareable(encoded.reason);
        }
        refused.current = true;
        return;
      }
      refused.current = false;
      const text = encoded?.text;
      shared.current = text;
      writeHash(text);
      writeAutosave(text);
    }, WRITE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [document, opening]);

  useEffect(() => {
    if (restored.current) {
      writeHash(shared.current);
    }
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    let until = 0;
    const step = (now: number) => {
      writeHash(shared.current);
      frame = now < until ? requestAnimationFrame(step) : 0;
    };
    // Each frame for a moment, so the hash lands after the router's own history update.
    const follow = () => {
      until = performance.now() + FOLLOW_MS;
      if (frame === 0) {
        frame = requestAnimationFrame(step);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]") !== null) {
        follow();
      }
    };
    const navigation = "navigation" in window ? window.navigation : undefined;
    window.addEventListener("popstate", follow);
    window.document.addEventListener("click", onClick);
    navigation?.addEventListener("currententrychange", follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", follow);
      window.document.removeEventListener("click", onClick);
      navigation?.removeEventListener("currententrychange", follow);
    };
  }, []);
}

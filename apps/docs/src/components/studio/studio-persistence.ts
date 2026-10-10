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

/** Puts `text` back on the address when a navigation has dropped the hash. */
function restoreHash(text: string | undefined): void {
  if (text !== undefined && window.location.hash === "") {
    const url = new URL(window.location.href);
    url.hash = text;
    window.history.replaceState(null, "", url);
  }
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
 * A page link drops the hash while the session outlives the page. This hook remembers the last
 * text it wrote and puts it back after every navigation that leaves the address without a hash,
 * so one owner covers every link: the Pages list, the phone's Sheet and the ⌘K palette. A click on
 * the current page's row keeps the pathname, so the Navigation API's entry changes trigger the
 * restore; a new pathname also does, for browsers without that API.
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
  // The last share text written to the address.
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
      const url = new URL(window.location.href);
      url.hash = text ?? "";
      window.history.replaceState(null, "", text === undefined ? `${url.pathname}${url.search}` : url);
      writeAutosave(text);
    }, WRITE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [document, opening]);

  useEffect(() => {
    restoreHash(shared.current);
  }, [pathname]);

  useEffect(() => {
    if (!("navigation" in window)) {
      return undefined;
    }
    const { navigation } = window;
    // Deferred, so the router finishes its own history update before the hash goes back.
    const onEntryChange = () => {
      queueMicrotask(() => {
        restoreHash(shared.current);
      });
    };
    navigation.addEventListener("currententrychange", onEntryChange);
    return () => {
      navigation.removeEventListener("currententrychange", onEntryChange);
    };
  }, []);
}

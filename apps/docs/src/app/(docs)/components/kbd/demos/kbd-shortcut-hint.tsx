"use client";

import { useEffect, useRef } from "react";

import { Kbd } from "@elmeragroup/fuse/kbd";

/** A search field that `/` focuses from anywhere outside another field. */
export function KbdShortcutHint() {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function focusOnSlash(event: KeyboardEvent) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select") !== null);
      if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        input.current?.focus();
      }
    }
    document.addEventListener("keydown", focusOnSlash);
    return () => {
      document.removeEventListener("keydown", focusOnSlash);
    };
  }, []);
  return (
    <div className="text-sm flex items-center gap-2">
      <input
        ref={input}
        type="search"
        aria-label="Search customers"
        aria-keyshortcuts="/"
        placeholder="Search customers"
        className="rounded-md border px-2 py-1"
      />
      <Kbd aria-hidden>/</Kbd>
    </div>
  );
}

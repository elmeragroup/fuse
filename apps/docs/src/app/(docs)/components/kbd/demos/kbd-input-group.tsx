"use client";

import { useEffect, useRef } from "react";

import { MagnifyingGlass } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { Kbd } from "@elmeragroup/fuse/kbd";

/** A search field that `/` focuses from anywhere outside another field. */
export function KbdInputGroup() {
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
    <InputGroup.Root className="max-w-sm">
      <InputGroup.Addon>
        <MagnifyingGlass />
      </InputGroup.Addon>
      <InputGroup.Input
        ref={input}
        aria-label="Search customers"
        aria-keyshortcuts="/"
        placeholder="Search customers…"
      />
      <InputGroup.Addon align="inline-end">
        <Kbd aria-hidden>/</Kbd>
      </InputGroup.Addon>
    </InputGroup.Root>
  );
}

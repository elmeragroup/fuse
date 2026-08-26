"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, ReactElement } from "react";

import { useRouter } from "next/navigation";

import { Dialog } from "@elmeragroup/ui/dialog";

import { matchSearchEntries } from "../lib/search";
import "./search-palette.css";

/**
 * The complete-site header search (docs-site.md §3.2).
 *
 * Docs-local by ruling — there is no library `Command` component — but the modal
 * mechanics are not reimplemented: the library `Dialog` supplies the focus trap, the
 * Escape dismissal and the focus return that accessibility.md §2 requires. Inside the
 * popup this is the ARIA combobox/listbox pattern: focus never leaves the text field,
 * arrow keys move `aria-activedescendant` over non-focusable options, and Enter
 * navigates. That is what makes typing and arrowing work in the same keystroke stream —
 * roving focus over the options would take focus off the field between every keypress.
 */
export function SearchPalette(): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Where focus goes on close. The hotkey opens the palette from anywhere, so the
  // invoking context is whatever was focused then — not necessarily the header button.
  const invokerRef = useRef<HTMLElement | null>(null);
  const listboxId = useId();

  const results = useMemo(() => matchSearchEntries(query), [query]);
  const activeEntry = results[activeIndex];

  const optionId = useCallback((index: number): string => `${listboxId}option-${String(index)}`, [listboxId]);

  const openPalette = useCallback((): void => {
    const active = document.activeElement;
    // `<body>` is what `activeElement` reports when nothing is focused; returning focus
    // there would strand the keyboard user, so the header affordance stands in.
    invokerRef.current =
      active instanceof HTMLElement && active !== document.body ? active : triggerRef.current;
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    function handleHotkey(event: globalThis.KeyboardEvent): void {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }
      // Chrome and Firefox both bind ⌘K/Ctrl+K to the address bar.
      event.preventDefault();
      if (open) {
        setOpen(false);
        return;
      }
      openPalette();
    }
    window.addEventListener("keydown", handleHotkey);
    return () => {
      window.removeEventListener("keydown", handleHotkey);
    };
  }, [open, openPalette]);

  const navigate = useCallback(
    (href: string): void => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuery(event.target.value);
    setActiveIndex(0);
  };

  const moveActive = (delta: number): void => {
    if (results.length === 0) {
      return;
    }
    setActiveIndex((index) => (index + delta + results.length) % results.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(results.length - 1, 0));
      return;
    }
    if (event.key === "Enter" && activeEntry !== undefined) {
      event.preventDefault();
      navigate(activeEntry.href);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="HeaderSearch"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={openPalette}>
        <span>Search</span>
        <kbd className="HeaderSearchKeys">⌘K</kbd>
      </button>
      <Dialog.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
        }}>
        <Dialog.Content
          className="SearchPalette top-[10vh] w-[min(34rem,calc(100vw-2rem))] translate-y-0 gap-0 p-0"
          showCloseButton={false}
          initialFocus={inputRef}
          finalFocus={invokerRef}>
          <Dialog.Title className="SearchPaletteTitle">Search the documentation</Dialog.Title>
          <input
            ref={inputRef}
            className="SearchPaletteInput"
            type="text"
            role="combobox"
            aria-label="Search the documentation"
            aria-autocomplete="list"
            aria-expanded
            aria-controls={listboxId}
            aria-activedescendant={activeEntry === undefined ? undefined : optionId(activeIndex)}
            autoComplete="off"
            placeholder="Search pages and components"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
          />
          <ul id={listboxId} role="listbox" aria-label="Search results" className="SearchPaletteResults">
            {results.map((entry, index) => (
              <li
                key={entry.href}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex || undefined}
                className="SearchPaletteOption"
                onMouseMove={() => {
                  setActiveIndex(index);
                }}
                onClick={() => {
                  navigate(entry.href);
                }}>
                <span className="SearchPaletteOptionTitle">{entry.title}</span>
                <span className="SearchPaletteOptionGroup">{entry.group}</span>
              </li>
            ))}
          </ul>
          {results.length === 0 ? (
            <p className="SearchPaletteEmpty" role="status">
              No pages match “{query}”.
            </p>
          ) : null}
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, ReactElement } from "react";

import { useRouter } from "next/navigation";

import { Dialog } from "@elmeragroup/ui/dialog";

import { matchSearchEntries } from "../lib/search";

const classNames = {
  trigger:
    "inline-flex min-h-[26px] cursor-pointer items-center gap-2 rounded-[6px] border border-docs-line bg-docs-soft p-[4px_8px] font-docs-mono text-[11.5px] font-medium text-docs-sub hover:text-docs-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-docs-ink",
  keys: "[font:inherit] text-docs-sub",
  palette:
    "top-[10vh] block w-[min(34rem,calc(100vw_-_2rem))] translate-y-0 gap-0 overflow-hidden p-0 font-docs-sans",
  input:
    "block w-full border-0 border-b border-docs-line bg-transparent p-[0.9rem_1rem] text-[0.95rem] text-docs-ink placeholder:text-docs-sub focus:outline-none",
  results: "m-0 max-h-[22rem] list-none overflow-y-auto p-[0.35rem]",
  option:
    "flex cursor-pointer items-baseline justify-between gap-4 rounded-[6px] p-[0.4rem_0.65rem] text-[0.85rem] text-docs-sub data-active:bg-docs-soft data-active:text-docs-ink",
  optionTitle: "font-medium text-docs-ink",
  optionGroup: "font-docs-mono text-[11px] font-medium text-docs-sub",
  empty: "m-0 p-4 text-[0.85rem] text-docs-sub",
} as const;

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
        className={classNames.trigger}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={openPalette}>
        <span>Search</span>
        <kbd className={classNames.keys}>⌘K</kbd>
      </button>
      <Dialog.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
        }}>
        <Dialog.Content
          className={classNames.palette}
          showCloseButton={false}
          initialFocus={inputRef}
          finalFocus={invokerRef}>
          <Dialog.Title className="sr-only">Search the documentation</Dialog.Title>
          <input
            ref={inputRef}
            className={classNames.input}
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
          <ul id={listboxId} role="listbox" aria-label="Search results" className={classNames.results}>
            {results.map((entry, index) => (
              <li
                key={entry.href}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex || undefined}
                className={classNames.option}
                onMouseMove={() => {
                  setActiveIndex(index);
                }}
                onClick={() => {
                  navigate(entry.href);
                }}>
                <span className={classNames.optionTitle}>{entry.title}</span>
                <span className={classNames.optionGroup}>{entry.group}</span>
              </li>
            ))}
          </ul>
          {results.length === 0 ? (
            <p className={classNames.empty} role="status">
              No pages match “{query}”.
            </p>
          ) : null}
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}

import { useState } from "react";
import type { ComponentProps, CSSProperties } from "react";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { useFakeTimeouts } from "../../../test/animation-frames";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { render } from "../../../test/browser-render";
import { expectFocusInsideFill, expectStateFill } from "../../../test/forced-highlight";
import { systemFace, withForcedColors } from "../../../test/media-emulation";
import { wheelAtPointer } from "../../../test/pointer-press";
import { differsFromCanvas, finishPopupEntrance, pixelsAt } from "../../../test/screenshot-pixels";
import type { Point } from "../../../test/screenshot-pixels";
import { toSrgb } from "../../../test/surface-paint";
import { cssVarColor, fkasPrivate, renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Select } from "./index";

function comboboxNamed(name?: string): HTMLElement {
  const locator =
    name === undefined ? page.getByRole("combobox") : page.getByRole("combobox", { name, exact: true });
  const element = locator.element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(name === undefined ? "expected a combobox" : `expected combobox ${name}`);
  }
  return element;
}

function listboxNamed(): HTMLElement {
  const element = page.getByRole("listbox").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a listbox");
  }
  return element;
}

function selectContent(): HTMLElement {
  const listbox = listboxNamed();
  const content = listbox.parentElement;
  if (!(content instanceof HTMLElement)) {
    throw new Error("expected select content around the listbox");
  }
  return content;
}

function optionNamed(name: string): HTMLElement {
  const element = page.getByRole("option", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected option ${name}`);
  }
  return element;
}

function highlightedOption(): HTMLElement {
  const element = page
    .getByRole("option")
    .elements()
    .find((option) => option.hasAttribute("data-highlighted"));
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a highlighted option");
  }
  return element;
}

const FRUIT_ITEMS = {
  apple: "Apple",
  banana: "Banana",
  cherry: "Cherry",
  date: "Date",
} as const;

function FruitSelect({
  onValueChange,
  onOpenChange,
  disabled,
  size,
  alignItemWithTrigger,
  sideOffset,
  extra,
}: {
  onValueChange?: ComponentProps<typeof Select.Root>["onValueChange"];
  onOpenChange?: ComponentProps<typeof Select.Root>["onOpenChange"];
  disabled?: boolean;
  size?: "sm" | "default";
  alignItemWithTrigger?: boolean;
  sideOffset?: number;
  extra?: boolean;
}) {
  return (
    <Select.Root
      items={FRUIT_ITEMS}
      disabled={disabled}
      onValueChange={onValueChange}
      onOpenChange={onOpenChange}>
      <Select.Trigger size={size} aria-label="Fruit">
        <Select.Value placeholder="Pick a fruit" />
      </Select.Trigger>
      <Select.Content alignItemWithTrigger={alignItemWithTrigger} sideOffset={sideOffset}>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Item value="banana">Banana</Select.Item>
        {extra ? (
          <Select.Item value="cherry" disabled>
            Cherry
          </Select.Item>
        ) : null}
        <Select.Item value="date">Date</Select.Item>
      </Select.Content>
    </Select.Root>
  );
}

// The popup mounts after the opening event settles, so both openers wait for the listbox and for
// the popup's entrance.
async function openedListbox(): Promise<HTMLElement> {
  await expect.element(page.getByRole("listbox")).toBeInTheDocument();
  const listbox = listboxNamed();
  await finishPopupEntrance(listbox);
  return listbox;
}

async function openWithClick(name = "Fruit"): Promise<HTMLElement> {
  await userEvent.click(comboboxNamed(name));
  return openedListbox();
}

async function openWithArrowDown(name = "Fruit"): Promise<HTMLElement> {
  comboboxNamed(name).focus();
  await userEvent.keyboard("{ArrowDown}");
  const listbox = await openedListbox();
  // Keyboard opening highlights an option once the list has registered its items, and focuses it
  // a frame later. A key sent before that focus reaches the trigger, which drops it.
  await vi.waitFor(() => expect(document.activeElement).toBe(highlightedOption()));
  return listbox;
}

// The entrance slide shifts the popup until it settles in place. It is a transition, which
// starts once Base UI drops the starting style, so the wait outlasts that frame first.
async function waitForContentSettled(): Promise<void> {
  await vi.waitFor(() => {
    expect(selectContent().hasAttribute("data-starting-style")).toBe(false);
  });
  await Promise.all(
    selectContent()
      .getAnimations()
      .map((animation) => animation.finished)
  );
}

describe("Select", () => {
  it("opens from the trigger click and exposes a listbox", async () => {
    const onOpenChange = vi.fn();
    renderThemed(<FruitSelect onOpenChange={onOpenChange} />);

    await openWithClick();
    const content = selectContent();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(content.getAttribute("data-slot")).toBe("select-content");
    expect(optionNamed("Apple")).toBeTruthy();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderThemed(<FruitSelect />);
    await openWithClick();

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    await expect.element(page.getByRole("combobox", { name: "Fruit", exact: true })).toHaveFocus();
  });

  it("selects via click, closes, and updates the trigger value", async () => {
    const onValueChange = vi.fn();
    renderThemed(<FruitSelect onValueChange={onValueChange} />);
    await openWithClick();
    await userEvent.click(optionNamed("Banana"));
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("banana");
    expect(comboboxNamed("Fruit").textContent).toContain("Banana");
  });

  it("moves highlight with arrows, selects with Enter, and honors Home/End", async () => {
    const onValueChange = vi.fn();
    renderThemed(<FruitSelect onValueChange={onValueChange} extra />);
    await openWithArrowDown();
    expect(highlightedOption().textContent).toContain("Apple");

    await userEvent.keyboard("{ArrowDown}");
    expect(highlightedOption().textContent).toContain("Banana");

    await userEvent.keyboard("{ArrowUp}");
    expect(highlightedOption().textContent).toContain("Apple");

    await userEvent.keyboard("{End}");
    expect(highlightedOption().textContent).toContain("Date");

    await userEvent.keyboard("{Home}");
    expect(highlightedOption().textContent).toContain("Apple");

    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange.mock.calls[0]?.[0]).toBe("banana");
  });

  it("changes the value from a closed trigger via typeahead without opening", async () => {
    const onValueChange = vi.fn();
    renderThemed(<FruitSelect onValueChange={onValueChange} />);
    const trigger = comboboxNamed("Fruit");
    trigger.focus();
    await userEvent.keyboard("b");
    expect(onValueChange.mock.calls[0]?.[0]).toBe("banana");
    expect(page.getByRole("listbox").query()).toBeNull();
    expect(trigger.textContent).toContain("Banana");
  });

  it("emits data-size for both trigger sizes", () => {
    renderThemed(
      <>
        <Select.Root>
          <Select.Trigger aria-label="Default size">
            <Select.Value placeholder="Default" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="a">A</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root>
          <Select.Trigger size="sm" aria-label="Small size">
            <Select.Value placeholder="Small" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="a">A</Select.Item>
          </Select.Content>
        </Select.Root>
      </>
    );
    expect(comboboxNamed("Default size").getAttribute("data-size")).toBe("default");
    expect(comboboxNamed("Small size").getAttribute("data-size")).toBe("sm");
  });

  it("emits data-align-trigger from alignItemWithTrigger", async () => {
    renderThemed(
      <>
        <Select.Root>
          <Select.Trigger aria-label="Aligned">
            <Select.Value placeholder="Aligned" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="a">A</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root>
          <Select.Trigger aria-label="Unaligned">
            <Select.Value placeholder="Unaligned" />
          </Select.Trigger>
          <Select.Content alignItemWithTrigger={false}>
            <Select.Item value="a">A</Select.Item>
          </Select.Content>
        </Select.Root>
      </>
    );
    await openWithClick("Aligned");
    expect(selectContent().getAttribute("data-align-trigger")).toBe("true");
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("listbox").query()).toBeNull();
    });
    await openWithClick("Unaligned");
    expect(selectContent().getAttribute("data-align-trigger")).toBe("false");
  });

  describe("placement", () => {
    // The scope sits away from the viewport origin, so a popup placed with viewport
    // coordinates inside a transformed block would land that offset away from its trigger.
    function OffsetScope({
      ancestor,
      alignItemWithTrigger,
      sideOffset,
    }: {
      ancestor: CSSProperties;
      alignItemWithTrigger?: boolean;
      sideOffset?: number;
    }) {
      return (
        <div style={{ ...ancestor, marginTop: 160, marginLeft: 120 }}>
          <ThemeScope theme={fkasPrivate}>
            <FruitSelect alignItemWithTrigger={alignItemWithTrigger} sideOffset={sideOffset} />
          </ThemeScope>
        </div>
      );
    }

    // A misplaced popup can scroll the page, and the scroll outlives its test.
    beforeEach(() => {
      window.scrollTo(0, 0);
    });

    async function openedContentAndTrigger(): Promise<{ content: DOMRect; trigger: DOMRect }> {
      // The entrance slide shifts the popup until it settles in place, and the opener finishes it.
      await openWithClick();
      return {
        content: selectContent().getBoundingClientRect(),
        trigger: comboboxNamed("Fruit").getBoundingClientRect(),
      };
    }

    it("lays the popup over its trigger by default on a plain page", async () => {
      render(<OffsetScope ancestor={{}} />);
      const { content, trigger } = await openedContentAndTrigger();

      // Item alignment overlays the selected row on the trigger instead of opening below it.
      expect(content.top).toBeLessThan(trigger.bottom);
      expect(content.bottom).toBeGreaterThan(trigger.top);
    });

    it("opens below its trigger inside a transformed scope with alignItemWithTrigger={false}", async () => {
      // Not the component's default of 4, so a popup that ignored the prop would sit 4px off.
      const sideOffset = 12;
      render(
        <OffsetScope
          ancestor={{ transform: "translateZ(0)" }}
          alignItemWithTrigger={false}
          sideOffset={sideOffset}
        />
      );
      const { content, trigger } = await openedContentAndTrigger();

      // Oracle: the default `side="bottom"` and the `sideOffset` passed in place the popup's top
      // that far under the trigger, overlapping it horizontally.
      expect(content.top - trigger.bottom).toBeCloseTo(sideOffset, 0);
      expect(content.left).toBeLessThan(trigger.right);
      expect(content.right).toBeGreaterThan(trigger.left);
    });
  });

  describe("long list", () => {
    // 12 rows of 32px in a popup capped at 160px, so the list overflows whichever way the popup
    // opens and stays clear of the viewport's edges. Base UI aligns the popup with the trigger only
    // when the trigger has room above it, so the trigger sits 120px down.
    const OPTIONS = Array.from({ length: 12 }, (_, index) => `Option ${index + 1}`);
    const POPUP_HEIGHT = 160;

    function LongSelect({
      alignItemWithTrigger,
      popupHeight = POPUP_HEIGHT,
      onScroll,
      onScrollEnd,
      onKeyDown,
    }: {
      alignItemWithTrigger: boolean;
      popupHeight?: number;
      onScroll?: ComponentProps<typeof Select.Content>["onScroll"];
      onScrollEnd?: ComponentProps<typeof Select.Content>["onScrollEnd"];
      onKeyDown?: ComponentProps<typeof Select.Content>["onKeyDown"];
    }) {
      return (
        <div style={{ marginTop: 120 }}>
          <Select.Root>
            <Select.Trigger aria-label="Long">
              <Select.Value placeholder="Pick" />
            </Select.Trigger>
            <Select.Content
              alignItemWithTrigger={alignItemWithTrigger}
              style={{ maxHeight: popupHeight }}
              onScroll={onScroll}
              onScrollEnd={onScrollEnd}
              onKeyDown={onKeyDown}>
              {OPTIONS.map((option) => (
                <Select.Item key={option} value={option}>
                  {option}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>
      );
    }

    function scrollArrow(edge: "top" | "bottom"): HTMLElement {
      const slot = edge === "top" ? "select-scroll-up-button" : "select-scroll-down-button";
      const arrow = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
      if (arrow === null) {
        throw new Error(`expected the ${slot} arrow`);
      }
      return arrow;
    }

    // A mouse open highlights no option, and Base UI focuses the popup a frame after it mounts. The
    // helper waits for that focus and for the entrance transition, so a key reaches the popup and a
    // measured position has stopped moving.
    async function openWithClickToPopupFocus(): Promise<void> {
      await openWithClick("Long");
      await vi.waitFor(() => expect(document.activeElement).toBe(selectContent()));
      expect(
        page
          .getByRole("option")
          .elements()
          .some((option) => option.hasAttribute("data-highlighted"))
      ).toBe(false);
      await waitForContentSettled();
    }

    beforeEach(() => {
      window.scrollTo(0, 0);
    });

    // Playwright scrolls a hover target into view by default, which moves the list before the
    // first mouse move. `scroll: "none"` leaves the scrolling to the arrow.
    it("shows the scroll-down arrow beside the trigger, and hovering it scrolls the list", async () => {
      renderThemed(<LongSelect alignItemWithTrigger={false} />);
      const listbox = await openWithClick("Long");

      const arrow = await vi.waitFor(() => scrollArrow("bottom"));
      expect(listbox.scrollTop).toBe(0);
      await userEvent.hover(arrow, { scroll: "none" });
      await vi.waitFor(() => expect(listbox.scrollTop).toBeGreaterThan(0));
    });

    // The pointer rests 8px below the list's top, where the up arrow mounts after the first
    // gesture. The second gesture lands on the arrow and still scrolls the list. A popup aligned
    // with the trigger keeps the list as its scroller with the arrows outside or inside the list,
    // so only the second gesture depends on where the arrow sits.
    it("keeps scrolling the list when a wheel gesture lands on the up arrow", async () => {
      renderThemed(<LongSelect alignItemWithTrigger />);
      const listbox = await openWithClick("Long");
      await userEvent.hover(listbox, { position: { x: listbox.clientWidth / 2, y: 8 } });

      await wheelAtPointer(72);
      await vi.waitFor(() => expect(listbox.scrollTop).toBe(72));
      await vi.waitFor(() => scrollArrow("top"));
      await wheelAtPointer(72);
      await vi.waitFor(() => expect(listbox.scrollTop).toBe(144));
    });

    // The visible top or bottom edge of the list, measured from the top of its content. The top edge
    // is the bottom of the up arrow and the bottom edge is the top of the down arrow. The arrows sit
    // at fixed offsets in the list, so each edge is that offset plus the scroll position.
    function visibleEdge(listbox: HTMLElement, edge: "top" | "bottom"): number {
      const arrow = scrollArrow(edge).getBoundingClientRect();
      const offset = (edge === "top" ? arrow.bottom : arrow.top) - listbox.getBoundingClientRect().top;
      return listbox.scrollTop + offset;
    }

    // A page ends where the row under the down arrow starts the next one, clear of the up arrow, so
    // paging shows every row. PageUp starts at the bottom of the list, more than a page down, so
    // the browser cannot clamp it to 0. Focus stays on the popup, where Base UI put it. The inline
    // `scroll-behavior` makes each page land before the key resolves.
    it("scrolls the list by a page with PageDown and PageUp after a mouse open", async () => {
      renderThemed(<LongSelect alignItemWithTrigger={false} />);
      await openWithClickToPopupFocus();
      const listbox = listboxNamed();
      listbox.style.scrollBehavior = "auto";

      const bottomBefore = visibleEdge(listbox, "bottom");
      await userEvent.keyboard("{PageDown}");
      await vi.waitFor(() => scrollArrow("top"));
      expect(Math.abs(visibleEdge(listbox, "top") - bottomBefore)).toBeLessThanOrEqual(1);
      expect(document.activeElement).toBe(selectContent());

      listbox.scrollTop = listbox.scrollHeight;
      await vi.waitFor(() =>
        expect(document.querySelector('[data-slot="select-scroll-down-button"]')).toBeNull()
      );
      const topBefore = visibleEdge(listbox, "top");
      await userEvent.keyboard("{PageUp}");
      await vi.waitFor(() => scrollArrow("bottom"));
      expect(listbox.scrollTop).toBeGreaterThan(0);
      expect(Math.abs(visibleEdge(listbox, "bottom") - topBefore)).toBeLessThanOrEqual(1);
      expect(document.activeElement).toBe(selectContent());
      await userEvent.keyboard("{ArrowDown}");
      await vi.waitFor(() => expect(document.activeElement).toBe(highlightedOption()));
    });

    // A 46px popup leaves a list shorter than its 48px of scroll padding, with no visible row
    // between the arrows, so a page is the whole list's height.
    it("pages a list shorter than its scroll padding by the list's height", async () => {
      renderThemed(<LongSelect alignItemWithTrigger={false} popupHeight={46} />);
      await openWithClickToPopupFocus();
      const listbox = listboxNamed();
      listbox.style.scrollBehavior = "auto";
      const style = getComputedStyle(listbox);
      const padding =
        Number.parseFloat(style.scrollPaddingTop) + Number.parseFloat(style.scrollPaddingBottom);
      const height = listbox.clientHeight;
      expect(height).toBeGreaterThan(0);
      expect(height).toBeLessThanOrEqual(padding);

      await userEvent.keyboard("{PageDown}");
      expect(listbox.scrollTop).toBe(height);
    });

    // This nonmodal Select opens beside its trigger, so no scroll lock holds the page. With nothing
    // to page in the list, PageDown keeps its browser default and scrolls the document.
    it("leaves PageDown to the browser when the list does not overflow", async () => {
      renderThemed(
        <div style={{ marginTop: 120, height: 3000 }}>
          <Select.Root modal={false}>
            <Select.Trigger aria-label="Long">
              <Select.Value placeholder="Pick" />
            </Select.Trigger>
            <Select.Content alignItemWithTrigger={false}>
              <Select.Item value="one">One</Select.Item>
              <Select.Item value="two">Two</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
      );
      await openWithClickToPopupFocus();
      expect(listboxNamed().scrollHeight).toBe(listboxNamed().clientHeight);

      await userEvent.keyboard("{PageDown}");
      await vi.waitFor(() => expect(window.scrollY).toBeGreaterThan(0));
    });

    // The handler cancels only the first PageDown. The second one is the control and pages the list.
    // The inline `scroll-behavior` makes a page land before the key resolves, so each offset is read
    // right after its key.
    it.each([
      {
        canceler: "preventDefault",
        cancel: (event: { preventDefault: () => void }) => event.preventDefault(),
      },
      {
        canceler: "preventBaseUIHandler",
        cancel: (event: { preventBaseUIHandler: () => void }) => event.preventBaseUIHandler(),
      },
    ] as const)("leaves the list in place when onKeyDown calls $canceler on PageDown", async ({ cancel }) => {
      let canceling = true;
      renderThemed(
        <LongSelect
          alignItemWithTrigger={false}
          onKeyDown={(event) => {
            if (event.key === "PageDown" && canceling) {
              cancel(event);
            }
          }}
        />
      );
      await openWithClickToPopupFocus();
      const listbox = listboxNamed();
      listbox.style.scrollBehavior = "auto";

      await userEvent.keyboard("{PageDown}");
      expect(listbox.scrollTop).toBe(0);
      expect(document.activeElement).toBe(selectContent());
      canceling = false;
      await userEvent.keyboard("{PageDown}");
      expect(listbox.scrollTop).toBeGreaterThan(0);
    });

    it("closes on Tab after a mouse open and focuses the next control", async () => {
      renderThemed(
        <>
          <LongSelect alignItemWithTrigger={false} />
          <button type="button">After</button>
        </>
      );
      await openWithClickToPopupFocus();

      await userEvent.keyboard("{Tab}");
      await vi.waitFor(() => expect(page.getByRole("listbox").query()).toBeNull());
      await expect.element(page.getByRole("button", { name: "After", exact: true })).toHaveFocus();
    });

    // Base UI's own composition puts the arrows beside the list in the popup, and each arrow lays
    // itself over the list's edge. The popup is then exactly as tall as the list. The up arrow
    // mounts once the list has scrolled, so the test scrolls it to measure both arrows.
    it("lays the public scroll arrows over a Base UI list instead of beside it", async () => {
      renderThemed(
        <div style={{ marginTop: 120 }}>
          <SelectPrimitive.Root>
            <SelectPrimitive.Trigger aria-label="Long">
              <SelectPrimitive.Value placeholder="Pick" />
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
              <SelectPrimitive.Positioner alignItemWithTrigger={false}>
                <SelectPrimitive.Popup style={{ position: "relative" }}>
                  <Select.ScrollUpButton />
                  <SelectPrimitive.List style={{ maxHeight: POPUP_HEIGHT, overflowY: "auto" }}>
                    {OPTIONS.map((option) => (
                      <Select.Item key={option} value={option}>
                        {option}
                      </Select.Item>
                    ))}
                  </SelectPrimitive.List>
                  <Select.ScrollDownButton />
                </SelectPrimitive.Popup>
              </SelectPrimitive.Positioner>
            </SelectPrimitive.Portal>
          </SelectPrimitive.Root>
        </div>
      );
      const listbox = await openWithClick("Long");
      await vi.waitFor(() => scrollArrow("bottom"));
      listbox.scrollTop = 72;

      const upArrow = (await vi.waitFor(() => scrollArrow("top"))).getBoundingClientRect();
      const downArrow = scrollArrow("bottom").getBoundingClientRect();
      const list = listbox.getBoundingClientRect();
      const popup = selectContent().getBoundingClientRect();
      expect(popup.height).toBeCloseTo(list.height, 0);
      expect(upArrow.top).toBeCloseTo(list.top, 0);
      expect(downArrow.bottom).toBeCloseTo(list.bottom, 0);
    });

    it("calls onScroll and onScrollEnd with the list as currentTarget when the list scrolls", async () => {
      const scrollTargets: Array<EventTarget> = [];
      const scrollEndTargets: Array<EventTarget> = [];
      renderThemed(
        <LongSelect
          alignItemWithTrigger={false}
          // React clears currentTarget once a handler returns, so each handler records it.
          onScroll={(event) => {
            scrollTargets.push(event.currentTarget);
          }}
          onScrollEnd={(event) => {
            scrollEndTargets.push(event.currentTarget);
          }}
        />
      );
      const listbox = await openWithClick("Long");

      await userEvent.wheel(listbox, { delta: { y: 100 } });
      await vi.waitFor(() => expect(listbox.scrollTop).toBeGreaterThan(0));
      await vi.waitFor(() => expect(scrollTargets.length).toBeGreaterThan(0));
      expect(scrollTargets.every((target) => target === listbox)).toBe(true);
      await vi.waitFor(() => expect(scrollEndTargets.length).toBeGreaterThan(0));
      expect(scrollEndTargets.every((target) => target === listbox)).toBe(true);
    });

    // Option 1 is highlighted on open. Six steps down land on Option 7, mid-list, where the list has
    // scrolled and the down arrow covers its bottom edge. Four steps back up land on Option 3, where
    // the list has scrolled back short of its top, so the up arrow covers its top edge.
    it.each([
      { alignItemWithTrigger: true, side: "none" },
      { alignItemWithTrigger: false, side: "bottom" },
    ] as const)(
      "keeps the highlighted option clear of both arrows with alignItemWithTrigger=$alignItemWithTrigger",
      async ({ alignItemWithTrigger, side }) => {
        renderThemed(<LongSelect alignItemWithTrigger={alignItemWithTrigger} />);
        const listbox = await openWithArrowDown("Long");
        // Base UI marks an aligned popup `data-side="none"`, and one that falls back from aligning
        // with the side it opens on.
        expect(selectContent().getAttribute("data-side")).toBe(side);
        expect(listbox.scrollHeight).toBeGreaterThan(listbox.clientHeight);

        for (let step = 0; step < 6; step += 1) {
          await userEvent.keyboard("{ArrowDown}");
        }
        expect(highlightedOption().textContent).toContain("Option 7");
        await vi.waitFor(() => {
          const list = listbox.getBoundingClientRect();
          const arrow = scrollArrow("bottom").getBoundingClientRect();
          expect(arrow.bottom).toBeCloseTo(list.bottom, 0);
          expect(highlightedOption().getBoundingClientRect().bottom).toBeLessThanOrEqual(arrow.top);
        });

        for (let step = 0; step < 4; step += 1) {
          await userEvent.keyboard("{ArrowUp}");
        }
        expect(highlightedOption().textContent).toContain("Option 3");
        await vi.waitFor(() => {
          const list = listbox.getBoundingClientRect();
          const arrow = scrollArrow("top").getBoundingClientRect();
          expect(arrow.top).toBeCloseTo(list.top, 0);
          expect(highlightedOption().getBoundingClientRect().top).toBeGreaterThanOrEqual(arrow.bottom);
        });
      }
    );
  });

  it("names a group from Select.Label", async () => {
    renderThemed(
      <Select.Root>
        <Select.Trigger aria-label="Grouped">
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            <Select.Label>Citrus</Select.Label>
            <Select.Item value="lemon">Lemon</Select.Item>
          </Select.Group>
        </Select.Content>
      </Select.Root>
    );
    await openWithClick("Grouped");
    await expect.element(page.getByRole("group", { name: "Citrus", exact: true })).toBeInTheDocument();
  });

  it("portals Content into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(<FruitSelect />);
    const scope = host.querySelector("[data-theme-brand]");
    const listbox = await openWithClick();
    expect(scope).not.toBeNull();
    expect(scope?.contains(listbox)).toBe(true);
    expect([...document.body.children].includes(listbox)).toBe(false);
  });

  it("portals Content into an explicit container element", async () => {
    function ExplicitContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Theme island" />
          {node ? (
            <Select.Root defaultOpen>
              <Select.Trigger aria-label="Island">
                <Select.Value placeholder="Pick" />
              </Select.Trigger>
              <Select.Content container={node}>
                <Select.Item value="apple">Apple</Select.Item>
              </Select.Content>
            </Select.Root>
          ) : null}
        </>
      );
    }
    renderThemed(<ExplicitContainer />);
    const listbox = await openedListbox();
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(listbox)).toBe(true);
    expect([...document.body.children].includes(listbox)).toBe(false);
  });

  it("gives the trigger the shared keyboard focus ring", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <FruitSelect />
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    const trigger = comboboxNamed("Fruit");
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before");
    }
    await assertFocusRingOnKeyboardAbsentOnMouse(previous, trigger);
  });

  it("fills a read-only trigger with the muted read-only fill and leaves a disabled one its card fill", () => {
    function FillProbe({
      name,
      readOnly,
      disabled,
    }: {
      name: string;
      readOnly?: boolean;
      disabled?: boolean;
    }) {
      return (
        <Select.Root readOnly={readOnly} disabled={disabled}>
          <Select.Trigger aria-label={name}>
            <Select.Value placeholder={name} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="a">A</Select.Item>
          </Select.Content>
        </Select.Root>
      );
    }
    renderThemed(
      <>
        <FillProbe name="Editable" />
        <FillProbe name="Read-only" readOnly />
        <FillProbe name="Disabled read-only" readOnly disabled />
        {/* A disabled fieldset disables the trigger natively, with no data-disabled. */}
        <fieldset disabled>
          <FillProbe name="Fieldset-disabled read-only" readOnly />
        </fieldset>
      </>
    );
    const fill = (name: string) => getComputedStyle(comboboxNamed(name)).backgroundColor;
    expect(fill("Editable")).toBe(cssVarColor(comboboxNamed("Editable"), "--card"));
    expect(fill("Read-only")).toBe(cssVarColor(comboboxNamed("Read-only"), "--muted"));
    expect(fill("Disabled read-only")).toBe(cssVarColor(comboboxNamed("Disabled read-only"), "--card"));
    const inherited = comboboxNamed("Fieldset-disabled read-only");
    expect(inherited.matches(":disabled")).toBe(true);
    expect(inherited).not.toHaveAttribute("data-disabled");
    expect(fill("Fieldset-disabled read-only")).toBe(cssVarColor(inherited, "--card"));
  });
});

describe("Select highlighted option in forced-colors mode", () => {
  it("fills the option the keyboard highlights, apart from its neighbor", async () => {
    await withForcedColors("active", async () => {
      renderThemed(<FruitSelect />);
      await openWithArrowDown();
      expect(highlightedOption()).toBe(optionNamed("Apple"));
      await expectStateFill(optionNamed("Apple"), optionNamed("Banana"), "keyboard-highlighted option");
      await expectFocusInsideFill(optionNamed("Apple"), "keyboard-highlighted option focus outline");
    });
  });

  it("fills the option the pointer highlights in a menu opened by a click, apart from its neighbor", async () => {
    await withForcedColors("active", async () => {
      renderThemed(<FruitSelect />);
      await openWithClick();
      await userEvent.hover(optionNamed("Banana"));
      await vi.waitFor(() => expect(highlightedOption()).toBe(optionNamed("Banana")));
      await expectStateFill(optionNamed("Banana"), optionNamed("Date"), "pointer-highlighted option");
    });
  });

  it("outlines the focused option while the pointer on the scroll arrow clears its highlight", async () => {
    await withForcedColors("active", async () => {
      // The trigger sits mid-page, so the popup aligns its item with the trigger and its list
      // scrolls under a scroll arrow. The arrow unmounts once the list reaches its end, and 200
      // rows keep it mounted under the pointer for the whole test.
      const fruits = Array.from({ length: 200 }, (_, index) => `Fruit ${String(index + 1)}`);
      renderThemed(
        <div style={{ paddingTop: 400 }}>
          <Select.Root>
            <Select.Trigger aria-label="Fruit">
              <Select.Value placeholder="Pick a fruit" />
            </Select.Trigger>
            <Select.Content>
              {fruits.map((fruit) => (
                <Select.Item key={fruit} value={fruit}>
                  {fruit}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>
      );
      await openWithArrowDown();
      await userEvent.keyboard("{ArrowDown>9/}");
      const row = optionNamed("Fruit 10");
      await vi.waitFor(() => expect(document.activeElement).toBe(row));
      const arrow = await vi.waitUntil(() =>
        document.querySelector<HTMLElement>("[data-slot=select-scroll-down-button]")
      );
      // Base UI's arrow acts on a mouse move with movement. The first move onto the page reports
      // none, so the pointer moves to the backdrop first. Both arrows share their classes, so the
      // pointer goes to the arrow's point in the list, which holds it. Playwright would scroll the
      // list to bring that point into view, so `scroll: "none"` leaves the scrolling to the arrow.
      // The arrow scrolls one step per timeout. With fake timeouts the test runs one step,
      // then leaves the next pending, so the pointer stays on the arrow while the list holds
      // still. Vitest's pollers advance fake timers, so nothing below polls until they are real.
      // `useFakeTimeouts` also restores real timers when the test ends, even one that times out.
      useFakeTimeouts();
      try {
        await userEvent.hover(document.body);
        const list = listboxNamed();
        const listBox = list.getBoundingClientRect();
        const arrowBox = arrow.getBoundingClientRect();
        const start = list.scrollTop;
        await userEvent.hover(list, {
          position: {
            x: arrowBox.left + arrowBox.width / 2 - listBox.left,
            y: arrowBox.top + arrowBox.height / 2 - listBox.top,
          },
          scroll: "none",
        });
        expect(list.scrollTop).toBe(start);
        vi.advanceTimersToNextTimer();
        expect(list.scrollTop).toBeGreaterThan(start);
        expect(arrow.isConnected).toBe(true);
        expect(row.hasAttribute("data-highlighted")).toBe(false);
        expect(row.matches(":focus-visible")).toBe(true);
        // The step scrolled the row out of view, and the test scrolls it back in.
        list.style.scrollBehavior = "auto";
        list.scrollTop = row.offsetTop - list.clientHeight / 2;
        const rowBox = row.getBoundingClientRect();
        expect(rowBox.top).toBeGreaterThan(listBox.top);
        expect(rowBox.bottom).toBeLessThan(listBox.bottom);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        expect(arrow.matches(":hover")).toBe(true);
        expect(row.hasAttribute("data-highlighted")).toBe(false);
        expect(row.matches(":focus-visible")).toBe(true);
        for (const animation of document.getAnimations()) animation.finish();
        // The 2px outline sits 2px to 4px in from the row's edge, so a pixel 3px in from the left
        // and top edges falls on its stroke and a pixel 5px in falls inside it, beside the text.
        // The stroke shows CanvasText and the inside shows Canvas, as the page resolves them,
        // where a Highlight fill would show at both. The next row shows Canvas at its stroke
        // pixels.
        const content = selectContent();
        const origin = content.getBoundingClientRect();
        const at = (x: number, y: number): Point => [x - Math.floor(origin.left), y - Math.floor(origin.top)];
        const pixelsIn = (option: HTMLElement, depth: number): Point[] => {
          const box = option.getBoundingClientRect();
          return [at(box.left + depth, box.top + box.height / 2), at(box.right - 10, box.top + depth)];
        };
        const { background: canvas, text: canvasText } = systemFace("Canvas");
        const named = [
          { name: "CanvasText", color: canvasText },
          { name: "Canvas", color: canvas },
        ].map(({ name, color }) => {
          const { r, g, b } = toSrgb(color);
          return { name, rgb: [r, g, b].map((channel) => channel * 255) };
        });
        const nameOf = (pixel: readonly number[]): string =>
          named.find(({ rgb }) =>
            rgb.every((channel, index) => Math.abs((pixel[index] ?? Number.NaN) - channel) <= 1)
          )?.name ?? `rgb(${pixel.slice(0, 3).join(", ")})`;
        const pixels = await pixelsAt(content, [
          ...pixelsIn(row, 3),
          ...pixelsIn(row, 5),
          ...pixelsIn(optionNamed("Fruit 11"), 3),
        ]);
        expect(pixels.map(nameOf)).toEqual([
          "CanvasText",
          "CanvasText",
          "Canvas",
          "Canvas",
          "Canvas",
          "Canvas",
        ]);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("draws no box around an option it does not highlight", async () => {
    await withForcedColors("active", async () => {
      renderThemed(<FruitSelect />);
      await openWithArrowDown();
      for (const animation of document.getAnimations()) animation.finish();
      const date = optionNamed("Date").getBoundingClientRect();
      const apple = optionNamed("Apple").getBoundingClientRect();
      // A pixel 3px above the row, where a 2px outline 2px out would paint, over the empty end of
      // the row above it. The empty end of the highlighted row shows the popup paints at all.
      const above = new DOMRect(date.right - 10, date.top - 3, 1, 1);
      const highlighted = new DOMRect(apple.right - 10, apple.top + apple.height / 2, 1, 1);
      expect(await differsFromCanvas(selectContent(), [above, highlighted])).toEqual([false, true]);
    });
  });
});

import { describe, expect, it } from "vitest";

import { readDemoSource } from "../src/lib/demo-source";
import { DESKTOP_VIEWPORT, waitForDemoHydration, waitForDocsShellHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { closeContext, launchSuiteBrowser } from "./suite-browser";

const browser = launchSuiteBrowser();

describe("Live code", () => {
  it("edits a part through the stage control: reveal, preview, commit, toggle, copy, reset and close", async () => {
    // Oracle: the Small example's own file, with `isPending` written in after the tag name, as
    // the serializer adds a prop the source does not write, and `size="sm"` written as `size="lg"`.
    const source = readDemoSource({ section: "components", slug: "button", file: "button-small.tsx" }).source;
    expect(source).toContain('<Button size="sm">');
    const edited = source.replace('<Button size="sm">', '<Button isPending size="lg">');
    const context = await browser().newContext({
      colorScheme: "light",
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const frame = page.locator("section[data-demo-frame]", { has: page.locator("h3#small") });
    await waitForDemoHydration(frame);
    await frame.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const part = frame.locator("[data-demo-stage]").getByRole("button", { name: "Filter results" });
    const control = frame.getByRole("button", { name: "Edit props" });
    await control.waitFor({ state: "attached" });
    const focusedRole = async (): Promise<string | null> =>
      page.evaluate(() => document.activeElement?.getAttribute("role") ?? null);
    const focusedName = async (): Promise<string | null> =>
      page.evaluate(() => document.activeElement?.textContent ?? null);

    const focusedLabel = async (): Promise<string | null> =>
      page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
    // The control sits in the frame's footer, after the stage and before the view switch in the
    // tab order.
    expect(await frame.locator("footer").getByRole("button", { name: "Edit props" }).count()).toBe(1);
    await part.focus();
    await page.keyboard.press("Tab");
    await expect.poll(focusedLabel).toBe("Edit props");
    await page.keyboard.press("Tab");
    await expect.poll(focusedName).toBe("Demo");
    await frame.getByRole("tab", { name: "Demo" }).blur();

    // What the reader sees of the control: its computed opacity, and whether a press at its centre
    // lands on it. It shows with the pointer away from the frame and nothing focused in it.
    await page.mouse.move(0, 0);
    expect(await control.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
    expect(
      await control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return hit !== null && element.contains(hit);
      })
    ).toBe(true);
    // Scrolled under the page's sticky header, the control gives the header the pointer.
    // Oracle: the header is the page's own `header`, outside every demo frame.
    await control.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 2));
    expect(
      await control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return hit !== null && hit.closest("header") !== null && hit.closest("[data-demo-frame]") === null;
      })
    ).toBe(true);
    // At the viewport's top, the frame leaves the menu room to grow down from the footer.
    await frame.evaluate((element) => element.scrollIntoView({ block: "start" }));

    await control.click();
    const menu = page.getByRole("menu", { name: "Edit props" });
    await menu.waitFor();
    // One site: the menu opens straight onto its props, headed with its part.
    await menu.getByText("<Button>", { exact: true }).waitFor();
    // It grows down from the footer, so the stage it edits stays uncovered.
    const stageBottom = await frame
      .locator("[data-demo-stage]")
      .evaluate((element) => element.getBoundingClientRect().bottom);
    expect(await menu.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(
      stageBottom
    );
    expect(await menu.getByRole("group").count()).toBe(0);

    // The size submenu opens on the current value.
    await menu.getByRole("menuitem", { name: /^size/u }).click();
    const sizes = page.getByRole("menu").filter({ has: page.getByRole("menuitemradio") });
    await sizes.waitFor();
    expect(await sizes.getByRole("menuitemradio").allTextContents()).toEqual(["default", "lg", "sm", "xs"]);
    await expect.poll(focusedName).toBe("sm");
    // Highlighting a value shows it on the stage without committing it, and Esc takes it back
    // with the submenu alone.
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => part.getAttribute("data-size")).toBe("xs");
    await page.keyboard.press("Escape");
    await expect.poll(async () => part.getAttribute("data-size")).toBe("sm");
    await sizes.waitFor({ state: "detached" });
    expect(await menu.isVisible()).toBe(true);

    // Choosing a value commits it, closes only the submenu, and hands focus back to its row.
    await menu.getByRole("menuitem", { name: /^size/u }).click();
    await sizes.getByRole("menuitemradio", { name: "lg" }).click();
    await expect.poll(async () => part.getAttribute("data-size")).toBe("lg");
    await sizes.waitFor({ state: "detached" });
    expect(await menu.isVisible()).toBe(true);
    expect(await focusedRole()).toBe("menuitem");
    expect(await focusedName()).toBe("sizelg");
    // Choosing the value the part already has commits it too, and closes the submenu alone.
    await menu.getByRole("menuitem", { name: /^size/u }).click();
    await sizes.getByRole("menuitemradio", { name: "lg" }).click();
    await sizes.waitFor({ state: "detached" });
    expect(await menu.isVisible()).toBe(true);
    expect(await part.getAttribute("data-size")).toBe("lg");

    // A boolean toggles in place.
    const pending = menu.getByRole("menuitemcheckbox", { name: "isPending" });
    await pending.click();
    await expect.poll(async () => part.getAttribute("aria-busy")).toBe("true");
    expect(await pending.getAttribute("aria-checked")).toBe("true");
    expect(await menu.isVisible()).toBe(true);

    // Copy, the Code view and the Sheet carry the committed edits.
    await menu.getByRole("menuitem", { name: "Copy code" }).click();
    await menu.getByRole("menuitem", { name: "Copied" }).waitFor();
    expect(await page.evaluate(async () => navigator.clipboard.readText())).toBe(edited);
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    await frame.getByRole("tab", { name: "Code" }).click();
    const code = frame.locator("[data-demo-source] pre");
    await expect.poll(async () => code.textContent()).toBe(edited);
    await frame.getByRole("button", { name: "Open code" }).click();
    const sheet = page.getByRole("dialog", { name: "Small" });
    expect(await sheet.locator("pre").textContent()).toBe(edited);
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached" });

    // Reset drops the edits, after which it has none to drop. The control stays in the frame's
    // chrome under the Code view.
    await control.click();
    await menu.getByRole("menuitem", { name: "Reset" }).click();
    await expect.poll(async () => part.getAttribute("data-size")).toBe("sm");
    expect(await part.getAttribute("aria-busy")).toBeNull();
    expect(await menu.getByRole("menuitem", { name: "Reset" }).getAttribute("aria-disabled")).toBe("true");
    await expect.poll(async () => code.textContent()).toBe(source);
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    await closeContext(context);
  });

  it("reaches every site by keyboard and outlines the one whose row is highlighted", async () => {
    // Oracle: the Button group Nested demo at a phone's width. It has one site per line that
    // opens a `<Button` or `<ButtonGroup.Root` tag, in source order. Its page buttons render from
    // the first `<Button` after `PAGES.map`, one button per name the source's `PAGES` lists, and
    // Button writes the size it draws to `data-size`.
    const source = readDemoSource({
      section: "components",
      slug: "button-group",
      file: "button-group-nested.tsx",
    }).source;
    const lines = source.split("\n");
    const pagesAt = lines.findIndex((line) => line.includes("PAGES.map"));
    const pagesLine = lines.findIndex((line, index) => index > pagesAt && line.includes("<Button ")) + 1;
    const siteLabels = lines.flatMap((line, index) => {
      const part = /<(Button|ButtonGroup\.Root)[\s>]/u.exec(line)?.[1];
      return part === undefined ? [] : [`<${part}> · line ${String(index + 1)}`];
    });
    expect(siteLabels.length).toBeGreaterThan(1);
    const pageNames = [
      ...(/const PAGES = \[([^\]]*)\]/u.exec(source)?.[1] ?? "").matchAll(/"([^"]+)"/gu),
    ].map(([, name]) => name ?? "");
    expect(pageNames.length).toBeGreaterThan(1);
    const context = await browser().newContext({
      colorScheme: "light",
      reducedMotion: "reduce",
      viewport: { width: 390, height: 700 },
    });
    const page = await context.newPage();
    await page.goto(`${docsBaseUrl()}/components/button-group`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const frame = page.locator("section[data-demo-frame]", { has: page.locator("h3#nested") });
    await waitForDemoHydration(frame);
    await frame.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const stage = frame.locator("[data-demo-stage]");
    const pageButtons = stage.getByRole("group", { name: "Pages" }).getByRole("button");
    const previous = stage.getByRole("button", { name: "Previous" });
    const sizes = async (buttons: typeof previous): Promise<readonly (string | null)[]> =>
      buttons.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-size")));
    expect(await sizes(pageButtons)).toEqual(pageNames.map(() => "sm"));
    // The stage control, in the footer, is the frame's one tab stop before the view switch: Tab
    // leaves it for the switch, and Shift+Tab comes back to it.
    const control = frame.getByRole("button", { name: "Edit props" });
    await control.waitFor({ state: "attached" });
    await control.focus();
    await page.keyboard.press("Tab");
    await expect
      .poll(async () => page.evaluate(() => document.activeElement?.textContent ?? null))
      .toBe("Demo");
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(async () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null))
      .toBe("Edit props");

    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: "Edit props" });
    await menu.waitFor();
    await menu.getByText("All parts", { exact: true }).waitFor();

    // ArrowDown from the first row walks every site's rows, group by group in source order, to
    // Copy code.
    const focusedRow = async (): Promise<{ readonly group: string | null; readonly row: string }> =>
      page.evaluate(() => {
        const active = document.activeElement;
        const labelId = active?.closest('[role="group"]')?.getAttribute("aria-labelledby") ?? null;
        return {
          group: labelId === null ? null : (document.getElementById(labelId)?.textContent ?? null),
          row: active?.getAttribute("role")?.startsWith("menuitem") === true ? active.textContent : "",
        };
      });
    await expect.poll(async () => (await focusedRow()).row).not.toBe("");
    const walked: { readonly group: string | null; readonly row: string }[] = [];
    for (let step = 0; step < 40; step += 1) {
      const at = await focusedRow();
      if (at.row === "Copy code") break;
      walked.push(at);
      await page.keyboard.press("ArrowDown");
      await expect.poll(async () => focusedRow()).not.toEqual(at);
    }
    expect([...new Set(walked.map((at) => at.group))]).toEqual(siteLabels);
    const rendered = await menu.getByRole("group").evaluateAll((groups) =>
      groups.flatMap((group) => {
        const label =
          document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent ?? null;
        return [...group.querySelectorAll('[role^="menuitem"]')].map((row) => ({
          group: label,
          row: row.textContent,
        }));
      })
    );
    expect(walked).toEqual(rendered);
    const pagesSite = menu.getByRole("group").filter({ hasText: `<Button> · line ${String(pagesLine)}` });
    const size = pagesSite.getByRole("menuitem", { name: /^size/u });
    await size.focus();

    // Highlighting the row outlines exactly the page buttons, box for box, in the editor's own
    // layer beside the stage.
    const outline = frame.locator("[data-stage-outline]");
    const outlined = async (): Promise<readonly { x: number; y: number; width: number; height: number }[]> =>
      outline.locator("> *").evaluateAll((boxes) =>
        boxes.map((box) => {
          const { x, y, width, height } = box.getBoundingClientRect();
          return { x, y, width, height };
        })
      );
    await expect.poll(async () => outline.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
    const expected = await Promise.all(
      pageNames.map(async (name) => {
        const box = await pageButtons.getByText(name, { exact: true }).boundingBox();
        if (box === null) throw new Error(`The page ${name} button has no box.`);
        return box;
      })
    );
    const boxes = await outlined();
    expect(boxes).toHaveLength(expected.length);
    for (const [index, box] of boxes.entries()) {
      const want = expected[index];
      expect(box.x).toBeCloseTo(want?.x ?? Number.NaN, 0);
      expect(box.y).toBeCloseTo(want?.y ?? Number.NaN, 0);
      expect(box.width).toBeCloseTo(want?.width ?? Number.NaN, 0);
      expect(box.height).toBeCloseTo(want?.height ?? Number.NaN, 0);
    }

    // The outline holds while the row's submenu is open, and the edit lands on the site.
    await page.keyboard.press("Enter");
    await page.getByRole("menuitemradio", { name: "default", exact: true }).focus();
    expect(await outline.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
    await page.keyboard.press("Enter");
    await expect.poll(async () => sizes(pageButtons)).toEqual(pageNames.map(() => "default"));
    expect(await previous.getAttribute("data-size")).toBe("icon-sm");
    // A row of no site, such as Copy, clears it.
    await menu.getByRole("menuitem", { name: "Copy code" }).focus();
    await expect.poll(async () => outline.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    await expect.poll(async () => outline.count()).toBe(0);
    await closeContext(context);
  });

  it("places the menu and its submenus where they fit, on the control and the rows they open from", async () => {
    // Oracle: the menu's design. It grows down from the control while its header and five rows
    // fit below it, scrolling its rows when it is taller, and toward the inline end while its width
    // fits that way; its header icon lies on the control. A submenu's header lies on the row it
    // opens from, with at least five options showing beside it, and the menu behind it sinks
    // around that row without moving it. Measured boxes and hit-testing, independent of the code.
    const context = await browser().newContext({ colorScheme: "light", viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    await page.goto(`${docsBaseUrl()}/components/button-group`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const frame = page.locator("section[data-demo-frame]", { has: page.locator("h3#nested") });
    await waitForDemoHydration(frame);
    await frame.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const control = frame.getByRole("button", { name: "Edit props" });
    await control.waitFor({ state: "attached" });
    const menu = page.getByRole("menu", { name: "Edit props" });
    const options = page.locator('[data-slot="expandable-menu-submenu"]');
    type Box = {
      readonly top: number;
      readonly bottom: number;
      readonly left: number;
      readonly right: number;
    };
    const box = async (locator: typeof control): Promise<Box> =>
      locator.evaluate((element) => {
        const { top, bottom, left, right } = element.getBoundingClientRect();
        return { top, bottom, left, right };
      });
    // Waits until a popup and its contents run no transition.
    const settled = async (popup: typeof menu): Promise<void> => {
      await expect
        .poll(async () => popup.evaluate((element) => element.getAnimations({ subtree: true }).length))
        .toBe(0);
    };
    // The header icon lies on the control, and the menu inside the viewport.
    const expectOnControl = async (): Promise<void> => {
      const [pip, at, popup] = await Promise.all([
        box(menu.locator('[data-slot="expandable-menu-pip"]')),
        box(control),
        box(menu),
      ]);
      expect((pip.left + pip.right) / 2).toBeCloseTo((at.left + at.right) / 2, 0);
      expect((pip.top + pip.bottom) / 2).toBeCloseTo((at.top + at.bottom) / 2, 0);
      expect(popup.left).toBeGreaterThanOrEqual(0);
      expect(popup.right).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
    };

    // With 340px below the control, the menu, taller than that, still opens below the stage.
    await control.evaluate((element) =>
      window.scrollBy(0, element.getBoundingClientRect().top - (window.innerHeight - 340))
    );
    await control.click();
    await settled(menu);
    const stage = await box(frame.locator("[data-demo-stage]"));
    const opened = await box(menu);
    expect(opened.top).toBeGreaterThanOrEqual(stage.bottom);
    expect(opened.bottom).toBeLessThanOrEqual(DESKTOP_VIEWPORT.height);
    expect(
      await menu
        .locator('[data-slot="expandable-menu-body"]')
        .evaluate((body) => body.scrollHeight > body.clientHeight)
    ).toBe(true);
    await expectOnControl();

    // The Next button's `size` row, the menu's last, sits too low for five of its nine options
    // below it.
    const sizeRow = menu
      .getByRole("group")
      .filter({ has: page.getByRole("menuitem", { name: /^size/u }) })
      .last()
      .getByRole("menuitem", { name: /^size/u });
    await sizeRow.scrollIntoViewIfNeeded();
    const rowBefore = await box(sizeRow);
    await sizeRow.click();
    await settled(options);
    await settled(menu);
    const row = await box(sizeRow);
    const header = await box(options.locator("> :first-child"));
    expect(header.top).toBeLessThanOrEqual(row.top + 0.5);
    expect(header.bottom).toBeGreaterThanOrEqual(row.bottom - 0.5);
    // The menu sank, narrower than its layout width, around the edge of the row the header meets.
    expect(
      await menu.evaluate(
        (element) =>
          element instanceof HTMLElement && element.getBoundingClientRect().width < element.offsetWidth - 1
      )
    ).toBe(true);
    const meets = (await options.getAttribute("data-side")) === "top" ? "bottom" : "top";
    expect(row[meets]).toBeCloseTo(rowBefore[meets], 0);
    // Options showing: inside the scrolling body, the submenu and the viewport at once.
    const shownOptions = await options.evaluate((element) => {
      const body = element.querySelector('[data-slot="expandable-menu-submenu-body"]');
      if (body === null) return 0;
      const view = body.getBoundingClientRect();
      const outer = element.getBoundingClientRect();
      const top = Math.max(view.top, outer.top, 0);
      const bottom = Math.min(view.bottom, outer.bottom, window.innerHeight);
      return [...element.querySelectorAll('[role="menuitemradio"]')].filter((option) => {
        const rect = option.getBoundingClientRect();
        return rect.top >= top && rect.bottom <= bottom;
      }).length;
    });
    expect(shownOptions).toBeGreaterThanOrEqual(5);
    expect(
      await options
        .locator('[data-slot="expandable-menu-submenu-body"]')
        .evaluate((body) => body.scrollHeight > body.clientHeight)
    ).toBe(true);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });

    // Where a host lays the control out at the footer's inline end, on a page too narrow for the
    // menu to grow on toward the inline end, it grows toward the inline start; and so it does from
    // the inline start of a right-to-left page, where its inline end is the left.
    const footer = frame.locator("footer");
    for (const layout of ["control at the inline end", "right-to-left"] as const) {
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      if (layout === "control at the inline end") {
        await page.setViewportSize({ width: 480, height: DESKTOP_VIEWPORT.height });
        await footer.evaluate((element) => {
          element.style.flexDirection = "row-reverse";
        });
      } else {
        await page.setViewportSize(DESKTOP_VIEWPORT);
        await footer.evaluate((element) => {
          element.style.flexDirection = "";
        });
        await page.evaluate(() => {
          document.documentElement.dir = "rtl";
        });
      }
      await frame.evaluate((element) => element.scrollIntoView({ block: "start" }));
      await control.click();
      await settled(menu);
      await expectOnControl();
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "detached" });
    }
    await closeContext(context);
  });

  it("lands every keyboard open and close at once, at both levels, and keeps the pointer's morph", async () => {
    // Oracle: the menu's design. An open or close from the keyboard, Enter, an arrow, Esc, Tab or
    // Enter on an option, runs no transition, even mid-way through a pointer's morph, while a
    // pointer's open and close run the morph. The page's animations are frozen through the
    // DevTools protocol, so a transition, once started, stays running and holds its popup mounted.
    const context = await browser().newContext({ colorScheme: "light" });
    const page = await context.newPage();
    await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const frame = page.locator("section[data-demo-frame]", { has: page.locator("h3#small") });
    await waitForDemoHydration(frame);
    await frame.evaluate((element) => element.scrollIntoView({ block: "start" }));
    const control = frame.getByRole("button", { name: "Edit props" });
    await control.waitFor({ state: "attached" });
    const menu = page.getByRole("menu", { name: "Edit props" });
    const size = menu.getByRole("menuitem", { name: /^size/u });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });
    // The transitions a popup and its contents run, once past its starting frame.
    const motion = async (slot: "popup" | "submenu"): Promise<number | "starting" | "unmounted"> =>
      page.evaluate((slot) => {
        const popup = document.querySelector(`[data-slot="expandable-menu-${slot}"]`);
        if (popup === null) return "unmounted";
        if (popup.hasAttribute("data-starting-style")) return "starting";
        const contents = popup.querySelector('[data-slot$="body"]');
        return [popup, contents].flatMap((element) => element?.getAnimations() ?? []).length;
      }, slot);

    // Enter opens the menu with nothing moving; Tab and Shift+Tab close it the same way.
    for (const leave of ["Tab", "Shift+Tab"]) {
      await control.focus();
      await page.keyboard.press("Enter");
      await expect.poll(async () => motion("popup")).toBe(0);
      await page.keyboard.press(leave);
      await expect.poll(async () => motion("popup")).toBe("unmounted");
    }

    // At the submenu: Enter on its row and ArrowRight open it, Enter on an option and Esc close it,
    // and the menu behind sinks and rises with nothing moving.
    await control.focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => motion("popup")).toBe(0);
    for (const [open, close] of [
      ["Enter", "Enter"],
      ["ArrowRight", "Escape"],
    ] as const) {
      await size.focus();
      await page.keyboard.press(open);
      await expect.poll(async () => motion("submenu")).toBe(0);
      expect(await motion("popup")).toBe(0);
      await expect
        .poll(async () => page.evaluate(() => document.activeElement?.getAttribute("aria-checked")))
        .toBe("true");
      await page.keyboard.press(close);
      await expect.poll(async () => motion("submenu")).toBe("unmounted");
      expect(await motion("popup")).toBe(0);
    }

    // A pointer opens the submenu with the morph, and Esc cuts it short at once.
    await size.click();
    await expect.poll(async () => motion("submenu")).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect.poll(async () => motion("submenu")).toBe("unmounted");
    expect(await motion("popup")).toBe(0);

    // A press outside closes the menu with the morph.
    await page.mouse.click(1, 1);
    await expect.poll(async () => motion("popup")).toBeGreaterThan(0);
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
    await menu.waitFor({ state: "detached" });
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });

    // A pointer opens the menu with the morph, from the control's circle: the control's centre is
    // the popup's, and the popup's own centre, past the circle, is not. Esc cuts it short at once.
    await control.click();
    await expect.poll(async () => motion("popup")).toBeGreaterThan(0);
    expect(
      await menu.evaluate(
        (popup, at) => {
          const own = (x: number, y: number): boolean => popup.contains(document.elementFromPoint(x, y));
          const { left, top, width, height } = popup.getBoundingClientRect();
          return [own(at.x, at.y), own(left + width / 2, top + height / 2)];
        },
        await control.evaluate((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x: x + width / 2, y: y + height / 2 };
        })
      )
    ).toEqual([true, false]);
    await page.keyboard.press("Escape");
    await expect.poll(async () => motion("popup")).toBe("unmounted");
    await closeContext(context);
  });

  it("outlines only what a scrolled list shows of a highlighted site, and follows the list's scroll", async () => {
    // Oracle: the Long lists Command demo, whose virtual list mounts overscan rows past its own
    // bottom edge. The list's and the rows' boxes, measured from the demo's markup, decide which
    // rows the reader sees, and the part of each row that shows.
    const context = await browser().newContext({ colorScheme: "light", reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${docsBaseUrl()}/components/command`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const frame = page.locator("section[data-demo-frame]", { has: page.locator("#virtualized") });
    await waitForDemoHydration(frame);
    await frame.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const control = frame.getByRole("button", { name: "Edit props" });
    await control.waitFor({ state: "attached" });
    await control.click();
    const menu = page.getByRole("menu", { name: "Edit props" });
    await menu.waitFor();
    await menu
      .getByRole("group")
      .filter({ hasText: "<Command.Item>" })
      .getByRole("menuitemcheckbox", { name: "disabled" })
      .focus();
    const outline = frame.locator("[data-stage-outline]");
    await expect.poll(async () => outline.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
    const list = frame.locator("[data-demo-stage]").getByRole("listbox");
    const listBox = await list.boundingBox();
    if (listBox === null) throw new Error("The list has no box.");
    const rows = await list.getByRole("option").evaluateAll((options) =>
      options.map((option) => {
        const { top, bottom } = option.getBoundingClientRect();
        return { top, bottom };
      })
    );
    const listBottom = listBox.y + listBox.height;
    // The demo does mount rows the list hides, so the case is real.
    expect(rows.some((row) => row.top >= listBottom)).toBe(true);
    const seen = rows.filter((row) => row.bottom > listBox.y && row.top < listBottom);
    // Each ring's painted area: its box grown by the ring's reach, its outline's width past its
    // offset, then cut by its clip-path's inset region when it has one. Without a clip-path the
    // whole ring paints.
    const painted = await outline.locator("> *").evaluateAll((boxes) =>
      boxes.map((box) => {
        const rect = box.getBoundingClientRect();
        const style = getComputedStyle(box);
        const ring = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
        const extent = {
          top: rect.top - ring,
          right: rect.right + ring,
          bottom: rect.bottom + ring,
          left: rect.left - ring,
        };
        if (style.clipPath === "none") return extent;
        const insets = [...style.clipPath.matchAll(/-?[\d.]+px/gu)].map(([value]) =>
          Number.parseFloat(value)
        );
        const [top = 0, right = top, bottom = top, left = right] = insets;
        return {
          top: Math.max(extent.top, rect.top + top),
          right: Math.min(extent.right, rect.right - right),
          bottom: Math.min(extent.bottom, rect.bottom - bottom),
          left: Math.max(extent.left, rect.left + left),
        };
      })
    );
    expect(painted).toHaveLength(seen.length);
    for (const ring of painted) {
      expect(ring.top).toBeGreaterThanOrEqual(listBox.y - 0.5);
      expect(ring.bottom).toBeLessThanOrEqual(listBottom + 0.5);
      expect(ring.left).toBeGreaterThanOrEqual(listBox.x - 0.5);
      expect(ring.right).toBeLessThanOrEqual(listBox.x + listBox.width + 0.5);
    }

    // Each ring's box spans the part of its row the list shows, rounded to whole px, and keeps
    // doing so when the list scrolls under the open menu.
    const ringsAndRows = async (): Promise<{ rings: string; rows: string }> => {
      const span = (top: number, bottom: number): string =>
        `${String(Math.round(top))}-${String(Math.round(bottom))}`;
      const rings = await outline.locator("> *").evaluateAll((boxes) =>
        boxes.map((box) => {
          const { top, bottom } = box.getBoundingClientRect();
          return { top, bottom };
        })
      );
      const shown = (
        await list.getByRole("option").evaluateAll((options) =>
          options.map((option) => {
            const { top, bottom } = option.getBoundingClientRect();
            return { top, bottom };
          })
        )
      )
        .filter((row) => row.bottom > listBox.y && row.top < listBottom)
        .toSorted((one, other) => one.top - other.top);
      return {
        rings: rings.map((ring) => span(ring.top, ring.bottom)).join(" "),
        rows: shown
          .map((row) => span(Math.max(row.top, listBox.y), Math.min(row.bottom, listBottom)))
          .join(" "),
      };
    };
    const before = await ringsAndRows();
    expect(before.rings).toBe(before.rows);
    await list.evaluate((element) => {
      element.scrollTop += 8;
    });
    await expect
      .poll(async () => {
        const after = await ringsAndRows();
        return after.rings === after.rows && after.rings !== before.rings;
      })
      .toBe(true);
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    await closeContext(context);
  });

  it("edits a popup's part from the stage control, and applies the edit when the popup opens", async () => {
    // Oracle: the Shortcuts Dropdown Menu demo, whose items render only while its menu is open.
    // Its Profile item's tag is the line above the line that reads "Profile".
    const lines = readDemoSource({
      section: "components",
      slug: "dropdown-menu",
      file: "dropdown-menu-shortcuts.tsx",
    }).source.split("\n");
    const profileLine = lines.findIndex((line) => line.includes("Profile"));
    expect(lines[profileLine - 1]?.trim()).toBe("<DropdownMenu.Item>");
    const context = await browser().newContext({ colorScheme: "light", reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${docsBaseUrl()}/components/dropdown-menu`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const frame = page.locator("section[data-demo-frame]", { has: page.locator("h3#shortcuts") });
    await waitForDemoHydration(frame);
    const opener = frame.locator("[data-demo-stage]").getByRole("button", { name: "Account" });
    await opener.click();
    const profile = page.getByRole("menuitem", { name: /^Profile/u });
    await profile.waitFor();
    await frame.getByRole("button", { name: "Edit props" }).click();
    const menu = page.getByRole("menu", { name: "Edit props" });
    await menu.waitFor();
    // Pressing the control closed the demo's menu; its parts stay in the editor's menu.
    await profile.waitFor({ state: "detached" });
    const item = menu
      .getByRole("group")
      .filter({ hasText: `<DropdownMenu.Item> · line ${String(profileLine)}` });
    const variant = item.getByRole("menuitem", { name: /^variant/u });
    await variant.click();
    await page.getByRole("menuitemradio", { name: "destructive" }).click();
    // The unmounted item's rows show its edits, and its switch turns back off.
    await expect.poll(async () => variant.textContent()).toBe("variantdestructive");
    const disabled = item.getByRole("menuitemcheckbox", { name: "disabled" });
    expect(await disabled.getAttribute("aria-checked")).toBe("false");
    await disabled.click();
    await expect.poll(async () => disabled.getAttribute("aria-checked")).toBe("true");
    await disabled.click();
    await expect.poll(async () => disabled.getAttribute("aria-checked")).toBe("false");
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    await opener.click();
    await expect.poll(async () => profile.getAttribute("data-variant")).toBe("destructive");
    expect(await profile.getAttribute("aria-disabled")).toBeNull();
    await closeContext(context);
  });

  it("drops a previewed value the stage cannot render, keeps the stage working and names the value", async () => {
    // Oracle: the Small Date Picker holds a PlainDate, which an hour granularity rejects.
    const context = await browser().newContext({ colorScheme: "light", reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${docsBaseUrl()}/components/date-picker`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const frame = page.locator("section[data-demo-frame]", { has: page.locator("h3#small") });
    await waitForDemoHydration(frame);
    const stage = frame.locator("[data-demo-stage]");
    await frame.getByRole("button", { name: "Edit props" }).click();
    const menu = page.getByRole("menu", { name: "Edit props" });
    await menu.getByText("<DatePickerField>", { exact: true }).waitFor();
    await menu.getByRole("menuitem", { name: /^granularity/u }).click();
    await page.getByRole("menuitemradio", { name: "hour" }).hover();
    await menu
      .getByRole("status")
      .filter({ hasText: 'granularity="hour" doesn\'t render in this example.' })
      .waitFor();
    // The stage renders the demo again, not the frame's reload prompt, and nothing was committed.
    await stage.getByText("Moving date").waitFor();
    expect(await stage.getByRole("alert").count()).toBe(0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    await frame.getByRole("tab", { name: "Code" }).click();
    await frame.getByRole("button", { name: "Copy code" }).waitFor();
    expect(await frame.locator("[data-demo-source] pre").textContent()).not.toContain("granularity=");
    await closeContext(context);
  });
});

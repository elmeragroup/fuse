import { describe, expect, it } from "vitest";

import { readDemoSource } from "../src/lib/demo-source";
import { waitForDemoHydration, waitForDocsShellHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { closeContext, launchSuiteBrowser } from "./suite-browser";

const browser = launchSuiteBrowser();

describe("Live code", () => {
  it("edits a prop through its token, re-renders the stage, copies the edited source and resets both", async () => {
    // Oracle: the Small example's own file, with `size="sm"` written as `size="lg"`.
    const source = readDemoSource({ section: "components", slug: "button", file: "button-small.tsx" }).source;
    expect(source).toContain('size="sm"');
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
    const stageButton = frame.locator("[data-demo-stage]").getByRole("button", { name: "Filter results" });
    expect(await stageButton.getAttribute("data-size")).toBe("sm");

    await frame.getByRole("tab", { name: "Code" }).click();
    const token = frame.getByRole("button", { name: 'size="sm"' });
    await token.click();
    // The option list is a dialog named for the part and prop it sets. The site has no
    // `aria-label`, so it offers no icon size, which would fail Button's props type.
    const options = page.getByRole("dialog", { name: "Button size" });
    expect(await options.getByRole("button").allTextContents()).toEqual(["default", "lg", "sm", "xs"]);
    await options.getByRole("button", { name: "lg", exact: true }).click();

    await expect.poll(async () => stageButton.getAttribute("data-size")).toBe("lg");
    // The stage stays in view under the Code tab.
    expect(await stageButton.isVisible()).toBe(true);
    await frame.getByRole("button", { name: 'size="lg"' }).waitFor();

    await frame.getByRole("button", { name: "Copy code" }).click();
    await frame.getByRole("button", { name: "Copied" }).waitFor();
    expect(await page.evaluate(async () => navigator.clipboard.readText())).toBe(
      source.replace('size="sm"', 'size="lg"')
    );

    await frame.getByRole("button", { name: "Reset" }).click();
    await expect.poll(async () => stageButton.getAttribute("data-size")).toBe("sm");
    await frame.getByRole("button", { name: 'size="sm"' }).waitFor();
    await closeContext(context);
  });

  it("returns focus to an added prop's token after a keyboard change of its value", async () => {
    const context = await browser().newContext({ colorScheme: "light", reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    // The default stage writes `<Button>Button</Button>`, so `variant` has to be added.
    const frame = page.locator('section[data-demo-frame][aria-labelledby="default-demo"]');
    await waitForDemoHydration(frame);
    await frame.getByRole("tab", { name: "Code" }).click();
    await frame.getByRole("button", { name: "Button props" }).click();
    await page.getByRole("dialog").getByRole("combobox", { name: "variant" }).click();
    await page.getByRole("option", { name: "outline", exact: true }).click();
    await page.keyboard.press("Escape");
    const added = frame.getByRole("button", { name: 'variant="outline"' });
    await added.click();
    const options = page.getByRole("dialog", { name: "Button variant" });
    await options.getByRole("button", { name: "ghost", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => page.evaluate(() => document.activeElement?.textContent ?? null))
      .toBe('variant="ghost"');
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-state") ?? null)).toBe(
      "added"
    );
    await closeContext(context);
  });

  it("reverts an edit the stage cannot render, keeps the stage working and names the value", async () => {
    // Oracle: the Basic Temporal Date Picker holds a PlainDate, which an hour granularity rejects.
    const context = await browser().newContext({ colorScheme: "light", reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${docsBaseUrl()}/components/temporal-date-picker`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const frame = page.locator("section[data-demo-frame]", { has: page.locator("h2#basic") });
    await waitForDemoHydration(frame);
    await frame.getByRole("tab", { name: "Code" }).click();
    await frame.getByRole("button", { name: "DatePickerField props" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "hour", exact: true }).click();
    await frame
      .getByRole("status")
      .filter({ hasText: 'granularity="hour" doesn\'t render in this example.' })
      .waitFor();
    await page.keyboard.press("Escape");
    // The stage renders the demo again, not the frame's reload prompt, and the code is unedited.
    await frame.locator("[data-demo-stage]").getByText("Moving date").waitFor();
    expect(await frame.locator("[data-demo-stage]").getByRole("alert").count()).toBe(0);
    expect(await frame.getByRole("button", { name: /granularity=/u }).count()).toBe(0);
    await closeContext(context);
  });
});

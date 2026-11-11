/**
 * Unit under test: the selection rows' SubSection partition in a real React Server Components
 * consumer, the docs app's "Server component" demo on `/components/selection-item`. A server
 * component writes `SelectionItem.Shell` with a direct SubSection, and client rows render
 * `CheckboxItem` and `RadioItem` around the titles and SubSections it passes them. Oracle: each
 * control's accessible name is its title alone, written by hand from the demo, and a click on a
 * SubSection's text leaves every control as it was, since the band sits outside the label.
 */
import { describe, expect, it } from "vitest";

import { waitForDemoHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { launchSuiteBrowser } from "./suite-browser";

/** Each control the demo renders: its role, its title and its SubSection's text. */
const ROWS = [
  { role: "checkbox", name: "Hourly readings", band: "Sent to your supplier every night." },
  { role: "checkbox", name: "Price alerts", band: "A text message when the spot price passes 2 kr/kWh." },
  { role: "radio", name: "Spot price", band: "Follows the hourly market." },
  { role: "radio", name: "Fixed price", band: "Locked for 12 months." },
] as const;

describe("SelectionItem rows written by a server component", () => {
  const browser = launchSuiteBrowser();

  it("name each control by its title and keep a SubSection click off the control after hydration", async () => {
    const page = await browser().newPage();
    await page.goto(new URL("/components/selection-item", docsBaseUrl()).href);
    const demo = page.getByRole("region", { name: "Server component", exact: true });
    await waitForDemoHydration(demo);

    const controls = (role: "checkbox" | "radio") => demo.getByRole(role);
    // An exact-name count does not wait, so a band inside a label fails here rather than timing
    // out. Soft, so a failure still reports what the clicks below did.
    const named = await Promise.all(
      ROWS.map(
        async ({ role, name }) =>
          `${name}: ${String(await demo.getByRole(role, { name, exact: true }).count())}`
      )
    );
    expect.soft(named).toEqual(ROWS.map(({ name }) => `${name}: 1`));
    expect(await controls("checkbox").count()).toBe(2);
    expect(await controls("radio").count()).toBe(2);

    for (const { band } of ROWS) {
      await demo.getByText(band, { exact: true }).click();
    }
    const checked = async (role: "checkbox" | "radio") =>
      controls(role).evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-checked"))
      );
    expect.soft(await checked("checkbox")).toEqual(["false", "false"]);
    expect.soft(await checked("radio")).toEqual(["false", "false"]);
    await page.context().close();
  });
});

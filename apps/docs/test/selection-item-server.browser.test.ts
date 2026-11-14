/**
 * Unit under test: the selection rows' SubSection partition in a real React Server Components
 * consumer, the docs app's server stages on `/components/selection-item`. "Server shell" writes
 * `SelectionItem.Shell` with a direct SubSection in a server component. "Server checkbox rows"
 * and "Server radio rows" render `CheckboxItem` and `RadioItem` in client rows around the titles
 * and SubSections a server component passes them. Oracle: each control's accessible name is its
 * title alone, written by hand from the demos, and a click on a SubSection's text leaves every
 * control as it was, since the band sits outside the label.
 */
import { describe, expect, it } from "vitest";

import { waitForDemoHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { launchSuiteBrowser } from "./suite-browser";

type Row = { readonly name: string; readonly band: string };

/** Each server stage: its title, its control role, and each control's title and SubSection text. */
const STAGES: readonly {
  readonly title: string;
  readonly role: "checkbox" | "radio";
  readonly rows: readonly Row[];
}[] = [
  {
    title: "Server shell",
    role: "checkbox",
    rows: [{ name: "Hourly readings", band: "Sent to your supplier every night." }],
  },
  {
    title: "Server checkbox rows",
    role: "checkbox",
    rows: [{ name: "Price alerts", band: "A text message when the spot price passes 2 kr/kWh." }],
  },
  {
    title: "Server radio rows",
    role: "radio",
    rows: [
      { name: "Spot price", band: "Follows the hourly market." },
      { name: "Fixed price", band: "Locked for 12 months." },
    ],
  },
];

describe("SelectionItem rows written by a server component", () => {
  const browser = launchSuiteBrowser();

  it.each(STAGES)(
    "$title: names each control by its title and keeps a SubSection click off the control after hydration",
    async ({ title, role, rows }) => {
      const page = await browser().newPage();
      await page.goto(new URL("/components/selection-item", docsBaseUrl()).href);
      const demo = page.getByRole("region", { name: title, exact: true });
      await waitForDemoHydration(demo);

      const controls = demo.getByRole(role);
      // An exact-name count does not wait, so a band inside a label fails here rather than timing
      // out. Soft, so a failure still reports what the clicks below did.
      const named = await Promise.all(
        rows.map(
          async ({ name }) => `${name}: ${String(await demo.getByRole(role, { name, exact: true }).count())}`
        )
      );
      expect.soft(named).toEqual(rows.map(({ name }) => `${name}: 1`));
      expect(await controls.count()).toBe(rows.length);

      for (const { band } of rows) {
        await demo.getByText(band, { exact: true }).click();
      }
      const checked = await controls.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-checked"))
      );
      expect.soft(checked).toEqual(rows.map(() => "false"));
      await page.context().close();
    }
  );
});

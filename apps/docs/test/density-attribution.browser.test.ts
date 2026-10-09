import { describe, expect, it } from "vitest";

import {
  PROBED_PROPERTIES,
  densityOwnedProperties,
  probeParts,
  roleViolation,
  showsUnmeasuredPart,
  startDensityPass,
} from "./density-attribution";
import type { ProbeOptions } from "./density-attribution";
import { launchSuiteBrowser } from "./suite-browser";

/**
 * The probe against real CSS. Each fixture is one of the reviewers' cases, in plain CSS with two
 * density metrics, so the unit under test is `probeParts`' reading of the browser's cascade and
 * the oracle is which declarations each fixture writes.
 */
const FIXTURES = `
<style>
  :root { --row-h: 32px; --surface-pad-sm: 4px; --control-text: 14px; }
  [data-demo-stage] { font-size: 14px; line-height: 20px; }
  .grows { display: flex; flex-direction: column; }
  .row { height: var(--row-h); }
  .literal { padding: 4px; }
  .token { padding: var(--surface-pad-sm); }
  .fixed-title { height: var(--row-h); }
  .control-type { font-size: var(--control-text); line-height: 1.5; }
  .own-fixed-type { font-size: 14px; line-height: 20px; }
</style>
<div data-demo-stage>
  <div data-slot="static-parent" class="grows"><div data-slot="growing-child" class="row">Row</div></div>
  <div data-slot="literal-pad" class="literal">Literal</div>
  <div data-slot="token-pad" class="token">Token</div>
  <div data-slot="fixed-title" class="fixed-title">Title with text</div>
  <div class="control-type">
    <span data-slot="inherits-type">Inherited</span>
    <span data-slot="own-fixed-type" class="own-fixed-type">Own fixed</span>
    <span data-slot="own-density-type" class="control-type">Own density</span>
  </div>
</div>`;

const SENTINELS = { "--row-h": "51px", "--surface-pad-sm": "9px", "--control-text": "24px" };

const browser = launchSuiteBrowser();

describe("density attribution in the browser", () => {
  it("credits a part only with density metrics its own declarations read", async () => {
    const page = await browser().newPage();
    await page.setContent(FIXTURES);
    const options: ProbeOptions = {
      scope: "stage",
      sentinels: SENTINELS,
      properties: PROBED_PROPERTIES,
      overrides: [],
    };
    const readings = await page.locator("[data-demo-stage]").evaluate(probeParts, options);
    await page.close();
    const owned = Object.fromEntries(
      readings.map(({ slot, probe }) => [slot, densityOwnedProperties(probe)])
    );
    expect(owned).toEqual({
      // A parent with no density declaration of its own is not credited with its child's growth.
      "static-parent": [],
      "growing-child": ["height"],
      // A literal 4px is not the small surface tier, though the two are the same length.
      "literal-pad": [],
      "token-pad": ["padding-top", "padding-right", "padding-bottom", "padding-left"],
      // Text inside a part does not hide its own height reading a metric.
      "fixed-title": ["height"],
      // Inherited type is the parent's; a part's own fixed type does not move.
      "inherits-type": [],
      "own-fixed-type": [],
      // A unitless line height scales with the font size, so only the font size moves.
      "own-density-type": ["font-size"],
    });
    const verdicts = Object.fromEntries(
      readings.map(({ slot, probe }) => [
        slot,
        [roleViolation("surface", probe), roleViolation("fixed", probe)],
      ])
    );
    expect(verdicts["static-parent"]?.[0], "a static parent fails a role").toBeDefined();
    expect(verdicts["literal-pad"]?.[0], "a literal padding fails a role").toBeDefined();
    expect(verdicts["fixed-title"]?.[1], "a text part whose height reads a metric fails fixed").toBeDefined();
    expect(verdicts["token-pad"]?.[0], "the small surface tier passes").toBeUndefined();
    expect(verdicts["inherits-type"]?.[1], "inherited type passes fixed").toBeUndefined();
  });

  it("catches a literal that replaces a metric at one density only, in that density's pass", async () => {
    const page = await browser().newPage();
    await page.setContent(`
<style>
  :root { --label-text: 14px; }
  .label { font-size: var(--label-text); }
  :root[data-density="comfortable"] .label { font-size: 16px; }
</style>
<div data-demo-stage><label data-slot="field-label" class="label">Email</label></div>`);
    const options: ProbeOptions = {
      scope: "stage",
      sentinels: { "--label-text": "24px" },
      properties: PROBED_PROPERTIES,
      overrides: [],
    };
    const verdictAt = async (density: "dense" | "comfortable") => {
      await page.evaluate((stamp) => {
        document.documentElement.setAttribute("data-density", stamp);
        document.querySelector("[data-demo-stage]")?.setAttribute("data-density", stamp);
        globalThis.densitySeen = new WeakSet<Element>();
      }, density);
      const [reading] = await page.locator("[data-demo-stage]").evaluate(probeParts, options);
      if (reading === undefined) {
        throw new Error("expected the label's reading");
      }
      return roleViolation("label", reading.probe);
    };
    expect(await verdictAt("dense"), "dense reads the label metric").toBeUndefined();
    expect(await verdictAt("comfortable"), "comfortable's literal reads none").toBe(
      "reads no density metric of its own"
    );
    await page.close();
  });

  it("measures a panel that is mounted hidden once it opens", async () => {
    const page = await browser().newPage();
    await page.setContent(`
<style>
  :root { --surface-pad-md: 12px; }
  .panel { padding: var(--surface-pad-md); }
</style>
<div data-demo-stage>
  <div data-slot="trigger">Open</div>
  <div data-slot="panel" class="panel" hidden>Panel</div>
</div>`);
    const options: ProbeOptions = {
      scope: "stage",
      sentinels: { "--surface-pad-md": "21px" },
      properties: PROBED_PROPERTIES,
      overrides: [],
    };
    await page.evaluate(startDensityPass, "dense");
    const stage = page.locator("[data-demo-stage]");
    const before = await stage.evaluate(probeParts, options);
    expect(
      before.map(({ slot }) => slot),
      "the hidden panel is not measured"
    ).toEqual(["trigger"]);
    expect(await page.evaluate(showsUnmeasuredPart), "nothing new shows yet").toBe(false);

    await page.evaluate(() => document.querySelector("[data-slot=panel]")?.removeAttribute("hidden"));
    expect(await page.evaluate(showsUnmeasuredPart), "the opened panel shows").toBe(true);
    const unseen: ProbeOptions = { ...options, scope: "unseen" };
    const opened = await stage.evaluate(probeParts, unseen);
    await page.close();
    expect(opened.map(({ slot, probe }) => [slot, roleViolation("surface", probe)])).toEqual([
      ["panel", undefined],
    ]);
  });
});

import { chromium } from "playwright";
import type { Browser, CDPSession, Page, Route } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_THEME, DOCUMENT_COLOR_SCHEME } from "../src/lib/theme";
import { docsBaseUrl } from "./docs-server";
import {
  COLOR_SCHEME_BOOTSTRAP_FAILURE_SENTINEL,
  DOCUMENT_BRAND,
  EXPECTED_BOOTSTRAP_MANIFEST,
  isLightCanvas,
  stampBootstrapNonce,
  stripContentEncoding,
} from "./html";

type ColorSchemeBootstrapManifest = {
  storageKey: string;
  defaultColorScheme: string;
  enableSystem: boolean;
  forcedColorScheme: string | undefined;
};

type FirstPaintProbe = {
  variant: string | null;
  brand: string | null;
  segment: string | null;
  density: string | null;
  dataTheme: string | null;
  manifest: ColorSchemeBootstrapManifest | undefined;
  background: string;
  colorScheme: string;
  reactHydrated: boolean;
};

type DelayedHydrationCase = {
  name: string;
  stored: string | null;
  colorScheme: "light" | "dark";
  expectedTheme: "light" | "dark";
};

const delayedCases: DelayedHydrationCase[] = [
  { name: "stored light", stored: "light", colorScheme: "dark", expectedTheme: "light" },
  { name: "stored dark", stored: "dark", colorScheme: "light", expectedTheme: "dark" },
  { name: "system light", stored: null, colorScheme: "light", expectedTheme: "light" },
  { name: "system dark", stored: null, colorScheme: "dark", expectedTheme: "dark" },
];

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

async function abortNextScripts(route: Route): Promise<void> {
  const url = route.request().url();
  if (url.includes("/_next/") && route.request().resourceType() === "script") {
    await route.abort();
    return;
  }
  await route.continue();
}

async function probeFirstPaint(page: Page): Promise<FirstPaintProbe> {
  return await page.evaluate(() => {
    const root = document.documentElement;
    const manifest = globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__;
    return {
      variant: root.getAttribute("data-theme-variant"),
      brand: root.getAttribute("data-theme-brand"),
      segment: root.getAttribute("data-theme-segment"),
      density: root.getAttribute("data-density"),
      dataTheme: root.getAttribute("data-theme"),
      manifest:
        manifest === undefined
          ? undefined
          : {
              storageKey: manifest.storageKey,
              defaultColorScheme: manifest.defaultColorScheme,
              enableSystem: manifest.enableSystem,
              forcedColorScheme: manifest.forcedColorScheme,
            },
      background: getComputedStyle(root).backgroundColor,
      colorScheme: root.style.colorScheme,
      reactHydrated: document.querySelector("next-route-announcer") !== null,
    };
  });
}

function expectFixedDocumentBrand(probe: Pick<FirstPaintProbe, "variant" | "brand" | "segment">): void {
  expect(probe.variant).toBe(DOCUMENT_BRAND.variant);
  expect(probe.brand).toBe(DOCUMENT_BRAND.brand);
  expect(probe.segment).toBe(DOCUMENT_BRAND.segment);
}

function expectDenseDocument(probe: Pick<FirstPaintProbe, "density">): void {
  expect(probe.density).toBe("dense");
}

async function readComputedProperty(page: Page, selector: string, property: string): Promise<string> {
  const client: CDPSession = await page.context().newCDPSession(page);
  await client.send("DOM.enable");
  await client.send("CSS.enable");
  const { root } = await client.send("DOM.getDocument", { depth: 1 });
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  });
  const { computedStyle } = await client.send("CSS.getComputedStyleForNode", { nodeId });
  const match = computedStyle.find((entry) => entry.name === property);
  await client.detach();
  return match?.value ?? "";
}

describe("docs first paint with hydration delayed", () => {
  it.each(delayedCases)(
    "$name sets the expected pre-React marker, brand, manifest, and light canvas",
    async ({ stored, colorScheme, expectedTheme }) => {
      const context = await browser.newContext({ colorScheme });
      await context.addInitScript(
        ({ key, value }) => {
          if (value === null) {
            window.localStorage.removeItem(key);
          } else {
            window.localStorage.setItem(key, value);
          }
        },
        { key: DOCUMENT_COLOR_SCHEME.storageKey, value: stored }
      );
      const page = await context.newPage();
      await page.route("**/*", abortNextScripts);
      await page.goto(`${docsBaseUrl()}/`, { waitUntil: "load" });

      const probe = await probeFirstPaint(page);
      expectFixedDocumentBrand(probe);
      expectDenseDocument(probe);
      expect(probe.dataTheme).toBe(expectedTheme);
      expect(probe.manifest).toEqual(EXPECTED_BOOTSTRAP_MANIFEST);
      expect(isLightCanvas(probe.background)).toBe(true);
      expect(probe.colorScheme).toBe("");
      expect(probe.reactHydrated).toBe(false);

      await context.close();
    }
  );
});

describe("docs JavaScript-disabled brand", () => {
  it("keeps brand attributes and the Elmera token surface without JavaScript", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${docsBaseUrl()}/`, { waitUntil: "domcontentloaded" });

    const html = page.locator("html");
    expect(await html.getAttribute("data-theme-variant")).toBe(DOCUMENT_BRAND.variant);
    expect(await html.getAttribute("data-theme-brand")).toBe(DOCUMENT_BRAND.brand);
    expect(await html.getAttribute("data-theme-segment")).toBe(DOCUMENT_BRAND.segment);
    expect(await html.getAttribute("data-density")).toBe("dense");

    const brand = (await readComputedProperty(page, "html", "--brand")).trim();
    const brandElma = (await readComputedProperty(page, "html", "--brand-elma")).trim();
    const brandNeutral = (await readComputedProperty(page, "html", "--neutral-950")).trim();
    const background = await readComputedProperty(page, "html", "background-color");
    expect(brandElma.length).toBeGreaterThan(0);
    expect(brand).toBe(brandElma);
    expect(brand).not.toBe(brandNeutral);
    expect(isLightCanvas(background)).toBe(true);

    await context.close();
  });
});

describe("docs enforcing nonce", () => {
  // Chosen strategy: intercept the docs HTML, stamp nonce on the host ColorSchemeScript,
  // and serve an enforcing script-src nonce policy. Next hydration scripts are blocked on
  // purpose (they have no nonce), so hydration warnings are ruled out for this strategy.
  // No hash-CSP claim is made.

  async function openWithCsp(scriptNonce: string | null, cspNonce: string): Promise<Page> {
    const page = await browser.newPage();
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      let body = await response.text();
      if (scriptNonce !== null) {
        body = stampBootstrapNonce(body, scriptNonce);
      }
      await route.fulfill({
        status: response.status(),
        headers: {
          ...stripContentEncoding(response.headers()),
          "content-security-policy": `script-src 'nonce-${cspNonce}'`,
          "content-type": "text/html; charset=utf-8",
        },
        body,
      });
    });
    await page.goto(`${docsBaseUrl()}/`, { waitUntil: "domcontentloaded" });
    return page;
  }

  it("executes the bootstrap when the nonce matches the enforcing policy", async () => {
    const nonce = "elmera-docs-bootstrap";
    const page = await openWithCsp(nonce, nonce);
    const probe = await probeFirstPaint(page);
    expectFixedDocumentBrand(probe);
    expectDenseDocument(probe);
    expect(probe.manifest).toEqual(EXPECTED_BOOTSTRAP_MANIFEST);
    expect(probe.dataTheme === "light" || probe.dataTheme === "dark").toBe(true);
    await page.close();
  });

  it("leaves the failure sentinel when the nonce is missing", async () => {
    const page = await openWithCsp(null, "elmera-docs-bootstrap");
    const probe = await probeFirstPaint(page);
    expect(probe.manifest).toBe(COLOR_SCHEME_BOOTSTRAP_FAILURE_SENTINEL.manifest);
    expect(probe.dataTheme).toBe(COLOR_SCHEME_BOOTSTRAP_FAILURE_SENTINEL.dataTheme);
    await page.close();
  });

  it("leaves the failure sentinel when the nonce is wrong", async () => {
    const page = await openWithCsp("wrong-nonce", "elmera-docs-bootstrap");
    const probe = await probeFirstPaint(page);
    expect(probe.manifest).toBe(COLOR_SCHEME_BOOTSTRAP_FAILURE_SENTINEL.manifest);
    expect(probe.dataTheme).toBe(COLOR_SCHEME_BOOTSTRAP_FAILURE_SENTINEL.dataTheme);
    await page.close();
  });
});

describe("docs picker vs document theme", () => {
  it("themes only preview scopes and leaves the document on internal/elma/private", async () => {
    const page = await browser.newPage();
    const hydrationWarnings: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/hydrat/i.test(text)) {
        hydrationWarnings.push(text);
      }
    });
    await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Button", exact: true }).waitFor();

    const initial = await page.evaluate(() => {
      const root = document.documentElement;
      const stage = document.querySelector(".DemoStage");
      return {
        documentBrand: root.getAttribute("data-theme-brand"),
        documentVariant: root.getAttribute("data-theme-variant"),
        documentSegment: root.getAttribute("data-theme-segment"),
        documentDensity: root.getAttribute("data-density"),
        stageBrand: stage?.getAttribute("data-theme-brand") ?? null,
        stageVariant: stage?.getAttribute("data-theme-variant") ?? null,
        stageSegment: stage?.getAttribute("data-theme-segment") ?? null,
        stageDensity: stage?.getAttribute("data-density") ?? null,
        documentToken: getComputedStyle(root).getPropertyValue("--brand").trim(),
        stageToken: stage === null ? "" : getComputedStyle(stage).getPropertyValue("--brand").trim(),
        slug: document.querySelector(".DemoSlug")?.textContent ?? "",
      };
    });

    expect(initial.documentVariant).toBe(DOCUMENT_BRAND.variant);
    expect(initial.documentBrand).toBe(DOCUMENT_BRAND.brand);
    expect(initial.documentSegment).toBe(DOCUMENT_BRAND.segment);
    expect(initial.documentDensity).toBe("dense");
    expect(initial.stageDensity).toBe("dense");
    expect(initial.stageVariant).toBe(DEFAULT_THEME.variant);
    expect(initial.stageBrand).toBe(DEFAULT_THEME.brand);
    expect(initial.stageSegment).toBe(DEFAULT_THEME.segment);
    expect(initial.slug).toContain("fkas");
    expect(initial.documentToken).not.toBe(initial.stageToken);

    await page.getByLabel("Brand").selectOption("tkas");

    const next = await page.evaluate(() => {
      const root = document.documentElement;
      const stage = document.querySelector(".DemoStage");
      return {
        documentBrand: root.getAttribute("data-theme-brand"),
        documentVariant: root.getAttribute("data-theme-variant"),
        documentSegment: root.getAttribute("data-theme-segment"),
        documentDensity: root.getAttribute("data-density"),
        stageBrand: stage?.getAttribute("data-theme-brand") ?? null,
        stageDensity: stage?.getAttribute("data-density") ?? null,
        stageToken: stage === null ? "" : getComputedStyle(stage).getPropertyValue("--brand").trim(),
        documentToken: getComputedStyle(root).getPropertyValue("--brand").trim(),
        slug: document.querySelector(".DemoSlug")?.textContent ?? "",
      };
    });

    expect(next.documentVariant).toBe("internal");
    expect(next.documentBrand).toBe("elma");
    expect(next.documentSegment).toBe("private");
    expect(next.documentDensity).toBe("dense");
    expect(next.stageDensity).toBe("dense");
    expect(next.stageBrand).toBe("tkas");
    expect(next.slug).toContain("tkas");
    expect(next.stageToken).not.toBe(next.documentToken);
    expect(next.stageToken).not.toBe(initial.stageToken);

    expect(hydrationWarnings.filter((text) => /data-theme|mismatch/i.test(text))).toEqual([]);
    await page.close();
  });

  it("retargets demo-stage control metrics to the preview variant default without restamping the document", async () => {
    const page = await browser.newPage();
    await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Button", exact: true }).waitFor();

    const initial = await page.evaluate(() => {
      const root = document.documentElement;
      const stage = document.querySelector(".DemoStage");
      const button = stage?.querySelector("button");
      return {
        documentDensity: root.getAttribute("data-density"),
        stageDensity: stage?.getAttribute("data-density") ?? null,
        stageVariant: stage?.getAttribute("data-theme-variant") ?? null,
        documentControlH: getComputedStyle(root).getPropertyValue("--control-h-md").trim(),
        stageControlH:
          stage === null ? "" : getComputedStyle(stage).getPropertyValue("--control-h-md").trim(),
        buttonHeight: button ? getComputedStyle(button).height : "",
        densityLabel: document.querySelector(".DemoDensity")?.textContent ?? "",
      };
    });

    expect(initial.documentDensity).toBe("dense");
    expect(initial.stageDensity).toBe("dense");
    expect(initial.stageVariant).toBe("internal");
    expect(initial.documentControlH).toBe("2.25rem");
    expect(initial.stageControlH).toBe("2.25rem");
    expect(initial.buttonHeight).toBe("36px");
    expect(initial.densityLabel).toBe("dense");

    await page.getByRole("combobox", { name: "Variant" }).selectOption("external");

    const next = await page.evaluate(() => {
      const root = document.documentElement;
      const stage = document.querySelector(".DemoStage");
      const button = stage?.querySelector("button");
      return {
        documentVariant: root.getAttribute("data-theme-variant"),
        documentDensity: root.getAttribute("data-density"),
        stageVariant: stage?.getAttribute("data-theme-variant") ?? null,
        stageDensity: stage?.getAttribute("data-density") ?? null,
        documentControlH: getComputedStyle(root).getPropertyValue("--control-h-md").trim(),
        stageControlH:
          stage === null ? "" : getComputedStyle(stage).getPropertyValue("--control-h-md").trim(),
        buttonHeight: button ? getComputedStyle(button).height : "",
        densityLabel: document.querySelector(".DemoDensity")?.textContent ?? "",
      };
    });

    expect(next.documentVariant).toBe("internal");
    expect(next.documentDensity).toBe("dense");
    expect(next.stageVariant).toBe("external");
    expect(next.stageDensity).toBe("comfortable");
    expect(next.documentControlH).toBe("2.25rem");
    expect(next.stageControlH).toBe("2.75rem");
    expect(next.buttonHeight).toBe("44px");
    expect(next.densityLabel).toBe("comfortable");

    await page.close();
  });
});

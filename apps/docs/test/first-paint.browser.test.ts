import type { CDPSession, Page, Route } from "playwright";
import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, DOCUMENT_COLOR_SCHEME } from "../src/lib/theme";
import { waitForDocsShellHydration } from "./demo-page";
import type { ThemeAttributes } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import {
  COLOR_SCHEME_BOOTSTRAP_FAILURE_SENTINEL,
  DOCUMENT_BRAND,
  EXPECTED_BOOTSTRAP_MANIFEST,
  canvasScheme,
  stampBootstrapNonce,
  stripContentEncoding,
} from "./html";
import { launchSuiteBrowser } from "./suite-browser";

type ColorSchemeBootstrapManifest = {
  storageKey: string;
  defaultColorScheme: string;
  enableSystem: boolean;
  forcedColorScheme: string | undefined;
};

type FirstPaintProbe = {
  identity: string | null;
  brand: string | null;
  segment: string | null;
  density: string | null;
  dataTheme: string | null;
  manifest: ColorSchemeBootstrapManifest | undefined;
  background: string;
  colorScheme: string;
  computedColorScheme: string;
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

const browser = launchSuiteBrowser();

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
    const styles = getComputedStyle(root);
    return {
      identity: root.getAttribute("data-theme-identity"),
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
      background: styles.backgroundColor,
      colorScheme: root.style.colorScheme,
      computedColorScheme: styles.colorScheme,
      reactHydrated: document.querySelector("next-route-announcer") !== null,
    };
  });
}

function expectFixedDocumentBrand(probe: Pick<FirstPaintProbe, "identity" | "brand" | "segment">): void {
  expect(probe.identity).toBe(DOCUMENT_BRAND.identity);
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
    "$name sets the expected pre-React marker, brand, manifest, and matching canvas",
    async ({ stored, colorScheme, expectedTheme }) => {
      const context = await browser().newContext({ colorScheme });
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
      await page.goto(`${docsBaseUrl()}/docs`, { waitUntil: "load" });

      const probe = await probeFirstPaint(page);
      expectFixedDocumentBrand(probe);
      expectDenseDocument(probe);
      expect(probe.dataTheme).toBe(expectedTheme);
      expect(probe.manifest).toEqual(EXPECTED_BOOTSTRAP_MANIFEST);
      expect(canvasScheme(probe.background), `canvas ${JSON.stringify(probe.background)}`).toBe(
        expectedTheme
      );
      expect(probe.computedColorScheme).toBe(expectedTheme);
      expect(probe.colorScheme).toBe("");
      expect(probe.reactHydrated).toBe(false);

      await context.close();
    }
  );
});

describe("docs JavaScript-disabled brand", () => {
  it("keeps brand attributes and the Elmera token surface without JavaScript", async () => {
    const context = await browser().newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    // CDP reads can otherwise race the external stylesheet and see an empty brand.
    await page.goto(`${docsBaseUrl()}/docs`, { waitUntil: "load" });

    const html = page.locator("html");
    expect(await html.getAttribute("data-theme-identity")).toBe(DOCUMENT_BRAND.identity);
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
    expect(canvasScheme(background), `canvas ${JSON.stringify(background)}`).toBe("light");

    await context.close();
  });
});

describe("docs enforcing nonce", () => {
  // Chosen strategy: intercept the docs HTML, stamp nonce on the host ColorSchemeScript,
  // and serve an enforcing script-src nonce policy. Next hydration scripts are blocked on
  // purpose (they have no nonce), so hydration warnings are ruled out for this strategy.
  // No hash-CSP claim is made.

  async function openWithCsp(scriptNonce: string | null, cspNonce: string): Promise<Page> {
    const page = await browser().newPage();
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
    await page.goto(`${docsBaseUrl()}/docs`, { waitUntil: "domcontentloaded" });
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

  it.each([
    ["missing", null],
    ["wrong", "wrong-nonce"],
  ] as const)("leaves the failure sentinel when the nonce is %s", async (_case, scriptNonce) => {
    const page = await openWithCsp(scriptNonce, "elmera-docs-bootstrap");
    const probe = await probeFirstPaint(page);
    expect(probe.manifest).toBe(COLOR_SCHEME_BOOTSTRAP_FAILURE_SENTINEL.manifest);
    expect(probe.dataTheme).toBe(COLOR_SCHEME_BOOTSTRAP_FAILURE_SENTINEL.dataTheme);
    await page.close();
  });
});

type ThemeScope = ThemeAttributes & { density: string | null; token: string };

async function readThemeScopes(page: Page): Promise<{ document: ThemeScope; stage: ThemeScope }> {
  return await page.evaluate(() => {
    const read = (scope: Element | null): ThemeScope => ({
      identity: scope?.getAttribute("data-theme-identity") ?? null,
      brand: scope?.getAttribute("data-theme-brand") ?? null,
      segment: scope?.getAttribute("data-theme-segment") ?? null,
      density: scope?.getAttribute("data-density") ?? null,
      token: scope === null ? "" : getComputedStyle(scope).getPropertyValue("--brand").trim(),
    });
    return {
      document: read(document.documentElement),
      stage: read(document.querySelector("[data-demo-stage]")),
    };
  });
}

type BrandPrimitives = {
  elma: string;
  fkas: string;
  tkas: string;
};

/**
 * The brand primitives the root declares for every brand, read apart from any
 * theme scope's `--brand`, so each scope's token has a value to match.
 */
async function readBrandPrimitives(page: Page): Promise<BrandPrimitives> {
  const primitives = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      elma: styles.getPropertyValue("--brand-elma").trim(),
      fkas: styles.getPropertyValue("--brand-fkas").trim(),
      tkas: styles.getPropertyValue("--brand-tkas").trim(),
    };
  });
  expect(new Set(Object.values(primitives)).size, JSON.stringify(primitives)).toBe(3);
  expect(Object.values(primitives)).not.toContain("");
  return primitives;
}

describe("docs picker vs document theme", () => {
  it("themes only preview scopes and leaves the document on neutral/elma/private", async () => {
    // With JavaScript off, neither hydration nor an inline script can add a theme
    // attribute the server HTML lacks.
    const serverPage = await browser().newPage({ javaScriptEnabled: false });
    await serverPage.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "load" });
    const initial = await readThemeScopes(serverPage);
    const serverBrands = await readBrandPrimitives(serverPage);
    await serverPage.close();

    expect(initial.document).toEqual({ ...DOCUMENT_BRAND, density: "dense", token: serverBrands.elma });
    expect(initial.stage).toEqual({ ...DEFAULT_THEME, density: "dense", token: serverBrands.fkas });

    const page = await browser().newPage();
    const hydrationWarnings: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/hydrat/i.test(text)) {
        hydrationWarnings.push(text);
      }
    });
    await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "load" });
    await page.getByRole("heading", { name: "Button", exact: true, level: 1 }).waitFor();

    // The server renders the Theme settings trigger before React attaches its handler,
    // so a press before hydration opens nothing.
    await waitForDocsShellHydration(page);
    const brands = await readBrandPrimitives(page);
    const before = await readThemeScopes(page);
    expect(before.stage.brand).toBe(DEFAULT_THEME.brand);
    expect(before.document.token).toBe(brands.elma);
    expect(before.stage.token).toBe(brands.fkas);

    await page.getByRole("button", { name: "Theme settings", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "TrøndelagKraft", exact: true }).click();
    await expect.poll(async () => (await readThemeScopes(page)).stage.brand).toBe("tkas");

    const next = await readThemeScopes(page);

    expect(next.document).toEqual({ ...DOCUMENT_BRAND, density: "dense", token: before.document.token });
    expect(next.stage).toMatchObject({ density: "dense", token: brands.tkas });

    expect(hydrationWarnings.filter((text) => /data-theme|mismatch/i.test(text))).toEqual([]);
    await page.close();
  });
});

import { chromium } from "playwright";
import type { Browser, BrowserContext, ConsoleMessage, Page, Route } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DOCUMENT_COLOR_SCHEME } from "../src/theme";
import {
  DOCUMENT_BRAND,
  EXPECTED_BOOTSTRAP_MANIFEST,
  EXPECTED_FORCED_DARK_MANIFEST,
  isLightCanvas,
} from "./html";
import type { ColorSchemeBootstrapManifest } from "./html";
import { staticThemeBaseUrl } from "./server";

type FirstPaintProbe = {
  variant: string | null;
  brand: string | null;
  segment: string | null;
  density: string | null;
  dataTheme: string | null;
  manifest: ColorSchemeBootstrapManifest | undefined;
  background: string;
  colorScheme: string;
  computedColorScheme: string;
  brandToken: string;
  brandElma: string;
  bootstrapScriptCount: number;
  reactMounted: boolean;
};

type FirstPaintCase = {
  name: string;
  stored: string | null;
  colorScheme: "light" | "dark";
  expectedTheme: "light" | "dark";
};

const firstPaintCases: FirstPaintCase[] = [
  { name: "stored light", stored: "light", colorScheme: "dark", expectedTheme: "light" },
  { name: "stored dark", stored: "dark", colorScheme: "light", expectedTheme: "dark" },
  { name: "system light", stored: "system", colorScheme: "light", expectedTheme: "light" },
  { name: "system dark", stored: "system", colorScheme: "dark", expectedTheme: "dark" },
  { name: "missing storage, system light", stored: null, colorScheme: "light", expectedTheme: "light" },
  { name: "missing storage, system dark", stored: null, colorScheme: "dark", expectedTheme: "dark" },
  { name: "invalid storage, system light", stored: "nope", colorScheme: "light", expectedTheme: "light" },
  { name: "invalid storage, system dark", stored: "{}", colorScheme: "dark", expectedTheme: "dark" },
];

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

function isJavaScriptAsset(route: Route): boolean {
  try {
    const url = new URL(route.request().url());
    return url.pathname.endsWith(".js");
  } catch {
    return false;
  }
}

async function abortModuleScripts(route: Route): Promise<void> {
  if (isJavaScriptAsset(route)) {
    await route.abort();
    return;
  }
  await route.continue();
}

async function waitForBootstrap(page: Page): Promise<void> {
  await page.waitForFunction(() => globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__ !== undefined);
  await waitForTokenCanvas(page);
}

async function seedStorage(context: BrowserContext, value: string | null): Promise<void> {
  await context.addInitScript(
    ({ key, stored }) => {
      if (stored === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, stored);
      }
    },
    { key: DOCUMENT_COLOR_SCHEME.storageKey, stored: value }
  );
}

async function probeFirstPaint(page: Page): Promise<FirstPaintProbe> {
  return await page.evaluate(() => {
    const root = document.documentElement;
    const manifest = globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__;
    const styles = getComputedStyle(root);
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
      background: styles.backgroundColor,
      colorScheme: root.style.colorScheme,
      computedColorScheme: styles.colorScheme,
      brandToken: styles.getPropertyValue("--brand").trim(),
      brandElma: styles.getPropertyValue("--brand-elma").trim(),
      bootstrapScriptCount: [...document.querySelectorAll("script")].filter((script) =>
        script.textContent.includes("__ELMERA_COLOR_SCHEME_BOOTSTRAP__")
      ).length,
      reactMounted: document.querySelector("main") !== null,
    };
  });
}

async function waitForTokenCanvas(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const styles = getComputedStyle(document.documentElement);
    return (
      styles.getPropertyValue("--background").trim() !== "" &&
      styles.getPropertyValue("--brand-elma").trim() !== ""
    );
  });
}

function expectFixedDocumentBrand(probe: Pick<FirstPaintProbe, "variant" | "brand" | "segment">): void {
  expect(probe.variant).toBe(DOCUMENT_BRAND.variant);
  expect(probe.brand).toBe(DOCUMENT_BRAND.brand);
  expect(probe.segment).toBe(DOCUMENT_BRAND.segment);
}

function expectDocumentDensity(
  probe: Pick<FirstPaintProbe, "density">,
  density: "dense" | "comfortable"
): void {
  expect(probe.density).toBe(density);
}

function expectTokenCanvas(probe: FirstPaintProbe): void {
  const scheme = probe.dataTheme === "dark" ? "dark" : "light";
  expect(isLightCanvas(probe.background)).toBe(scheme === "light");
  expect(probe.colorScheme).toBe("");
  expect(probe.computedColorScheme).toBe(scheme);
  expect(probe.brandElma.length).toBeGreaterThan(0);
  expect(probe.brandToken).toBe(probe.brandElma);
}

function isThemeWarning(text: string): boolean {
  return /hydrat|mismatch|bootstrap|data-theme|color-scheme/i.test(text);
}

function collectThemeWarnings(page: Page): string[] {
  const warnings: string[] = [];
  const onConsole = (message: ConsoleMessage) => {
    const text = message.text();
    if (message.type() === "warning" || message.type() === "error" || isThemeWarning(text)) {
      warnings.push(text);
    }
  };
  page.on("console", onConsole);
  page.on("pageerror", (error) => {
    warnings.push(error.message);
  });
  return warnings;
}

describe("static theme first paint with React blocked", () => {
  it.each(firstPaintCases)(
    "$name sets brand, marker, manifest, and the matching canvas before the module bundle",
    async ({ stored, colorScheme, expectedTheme }) => {
      const context = await browser.newContext({ colorScheme });
      await seedStorage(context, stored);
      const page = await context.newPage();
      await page.route("**/*", abortModuleScripts);
      await page.goto(`${staticThemeBaseUrl()}/`, { waitUntil: "commit" });
      await waitForBootstrap(page);

      const probe = await probeFirstPaint(page);
      expectFixedDocumentBrand(probe);
      expectDocumentDensity(probe, "dense");
      expect(probe.dataTheme).toBe(expectedTheme);
      expect(probe.manifest).toEqual(EXPECTED_BOOTSTRAP_MANIFEST);
      expectTokenCanvas(probe);
      expect(probe.bootstrapScriptCount).toBe(1);
      expect(probe.reactMounted).toBe(false);

      await context.close();
    }
  );

  it("writes forced dark before React while storage is light", async () => {
    const context = await browser.newContext({ colorScheme: "light" });
    await seedStorage(context, "light");
    const page = await context.newPage();
    await page.route("**/*", abortModuleScripts);
    await page.goto(`${staticThemeBaseUrl()}/forced-dark.html`, { waitUntil: "commit" });
    await waitForBootstrap(page);

    const probe = await probeFirstPaint(page);
    expectFixedDocumentBrand(probe);
    expectDocumentDensity(probe, "dense");
    expect(probe.dataTheme).toBe("dark");
    expect(probe.manifest).toEqual(EXPECTED_FORCED_DARK_MANIFEST);
    expectTokenCanvas(probe);
    expect(probe.bootstrapScriptCount).toBe(1);
    expect(probe.reactMounted).toBe(false);

    await context.close();
  });

  it("stamps comfortable density on the isolated preview before React", async () => {
    const context = await browser.newContext({ colorScheme: "light" });
    const page = await context.newPage();
    await page.route("**/*", abortModuleScripts);
    await page.goto(`${staticThemeBaseUrl()}/comfortable.html`, { waitUntil: "commit" });
    await waitForBootstrap(page);

    const probe = await probeFirstPaint(page);
    expectFixedDocumentBrand(probe);
    expectDocumentDensity(probe, "comfortable");
    expect(probe.reactMounted).toBe(false);

    await context.close();
  });
});

describe("static theme delayed React mount", () => {
  it("preserves the bootstrap values then exercises the provider runtime", async () => {
    let releaseModules: (() => void) | undefined;
    const modulesReady = new Promise<void>((resolve) => {
      releaseModules = resolve;
    });

    const context = await browser.newContext({ colorScheme: "dark" });
    await seedStorage(context, "light");
    const page = await context.newPage();
    const warnings = collectThemeWarnings(page);
    await page.route("**/*", async (route) => {
      if (isJavaScriptAsset(route)) {
        await modulesReady;
      }
      await route.continue();
    });

    await page.goto(`${staticThemeBaseUrl()}/`, { waitUntil: "commit" });
    await waitForBootstrap(page);

    const beforeReact = await probeFirstPaint(page);
    expectFixedDocumentBrand(beforeReact);
    expectDocumentDensity(beforeReact, "dense");
    expect(beforeReact.dataTheme).toBe("light");
    expect(beforeReact.manifest).toEqual(EXPECTED_BOOTSTRAP_MANIFEST);
    expectTokenCanvas(beforeReact);
    expect(beforeReact.reactMounted).toBe(false);
    expect(beforeReact.bootstrapScriptCount).toBe(1);

    releaseModules?.();
    await page.getByRole("heading", { name: "Static theme fixture" }).waitFor();

    const afterMount = await probeFirstPaint(page);
    expectFixedDocumentBrand(afterMount);
    expectDocumentDensity(afterMount, "dense");
    expect(afterMount.dataTheme).toBe("light");
    expect(afterMount.manifest).toEqual(EXPECTED_BOOTSTRAP_MANIFEST);
    expectTokenCanvas(afterMount);
    expect(afterMount.reactMounted).toBe(true);
    expect(afterMount.bootstrapScriptCount).toBe(1);
    expect(warnings.filter((text) => isThemeWarning(text))).toEqual([]);

    await page.getByRole("button", { name: "Use dark color scheme" }).click();
    const afterToggle = await probeFirstPaint(page);
    expectFixedDocumentBrand(afterToggle);
    expectDocumentDensity(afterToggle, "dense");
    expect(afterToggle.dataTheme).toBe("dark");
    expectTokenCanvas(afterToggle);
    expect(afterToggle.bootstrapScriptCount).toBe(1);
    await page.getByText("Color scheme preference dark").waitFor();
    await page.getByText("Resolved color scheme dark").waitFor();

    await context.close();
  });

  it("keeps a matching forced-dark configuration after delayed mount", async () => {
    let releaseModules: (() => void) | undefined;
    const modulesReady = new Promise<void>((resolve) => {
      releaseModules = resolve;
    });

    const context = await browser.newContext({ colorScheme: "light" });
    await seedStorage(context, "light");
    const page = await context.newPage();
    const warnings = collectThemeWarnings(page);
    await page.route("**/*", async (route) => {
      if (isJavaScriptAsset(route)) {
        await modulesReady;
      }
      await route.continue();
    });

    await page.goto(`${staticThemeBaseUrl()}/forced-dark.html`, { waitUntil: "commit" });
    await waitForBootstrap(page);

    const beforeReact = await probeFirstPaint(page);
    expect(beforeReact.dataTheme).toBe("dark");
    expect(beforeReact.manifest).toEqual(EXPECTED_FORCED_DARK_MANIFEST);
    expect(beforeReact.reactMounted).toBe(false);

    releaseModules?.();
    await page.getByRole("heading", { name: "Static theme fixture" }).waitFor();

    const afterMount = await probeFirstPaint(page);
    expectFixedDocumentBrand(afterMount);
    expectDocumentDensity(afterMount, "dense");
    expect(afterMount.dataTheme).toBe("dark");
    expect(afterMount.manifest).toEqual(EXPECTED_FORCED_DARK_MANIFEST);
    expectTokenCanvas(afterMount);
    expect(afterMount.reactMounted).toBe(true);
    expect(warnings.filter((text) => isThemeWarning(text))).toEqual([]);

    await context.close();
  });
});

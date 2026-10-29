import type { BrowserCommand } from "vitest/node";

/**
 * Browser commands that run in the Vitest server and drive Playwright's media emulation, page
 * screenshots and print PDFs, which the browser context cannot reach. The chart forced-colours and
 * print judges are the callers.
 */
export const mediaCommands = {
  emulateMedia: (async (context, media: "screen" | "print", forcedColors: "active" | "none") => {
    await context.page.emulateMedia({ media, forcedColors });
  }) satisfies BrowserCommand<["screen" | "print", "active" | "none"]>,
  screenshotPage: (async (context) => {
    // The test runs in an iframe, so the shot is of that frame's element, whose pixels map to the
    // test page's viewport.
    const frame = await context.frame();
    const png = await (await frame.frameElement()).screenshot({ animations: "disabled" });
    return png.toString("base64");
  }) satisfies BrowserCommand<[]>,
  printPdf: (async (context) => {
    const pdf = await context.page.pdf({ width: "820px", height: "1200px" });
    return pdf.toString("base64");
  }) satisfies BrowserCommand<[]>,
};

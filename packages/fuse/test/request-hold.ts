import { onTestFinished } from "vitest";
import { commands } from "vitest/browser";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest registers custom commands by interface declaration merging; a type alias cannot augment.
  interface BrowserCommands {
    holdRequest: (url: string) => Promise<number>;
    releaseRequest: (url: string, token: number) => Promise<void>;
  }
}

/**
 * Holds the page's requests to `url` until the test releases them, or finishes. Give each test its
 * own URL, such as with a query, so the browser's cache cannot answer in the hold's place.
 *
 * @param url - The absolute URL to hold.
 * @returns A function that lets this hold's requests through. A second call, or one after the
 *   test finished, does nothing, even while a later hold of `url` holds it again.
 */
export async function holdRequest(url: string): Promise<() => Promise<void>> {
  const acquired = commands.holdRequest(url);
  // Teardown is registered before the reply, so a test that ends while it is on its way still
  // releases the hold. A registration that failed holds nothing.
  const release = async (): Promise<void> => {
    const token = await acquired.catch(() => null);
    if (token !== null) await commands.releaseRequest(url, token);
  };
  onTestFinished(release);
  await acquired;
  return release;
}

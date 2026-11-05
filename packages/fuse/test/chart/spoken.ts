/**
 * The virtual screen reader steps the chart suites share: start it on a host with focus on the
 * button before the chart, then press keys and hear the last phrase after each.
 */
import { virtual } from "@guidepup/virtual-screen-reader";

/**
 * Start the virtual screen reader on the host, with focus on the host's first button, the one the
 * suites render before the chart, so the first Tab enters the chart.
 *
 * @param host - The rendered host.
 */
export async function startReader(host: HTMLElement): Promise<void> {
  host.querySelector("button")?.focus();
  await virtual.start({ container: host });
}

/**
 * Press each key its number of times, and hear the last phrase after each.
 *
 * @param keys - Each key and how many times to press it in a row.
 * @returns The last phrase spoken after each key's presses.
 */
export async function phrasesAfter(keys: readonly (readonly [string, number])[]): Promise<string[]> {
  const heard: string[] = [];
  for (const [key, times] of keys) {
    for (let press = 0; press < times; press += 1) await virtual.press(key);
    heard.push((await virtual.spokenPhraseLog()).at(-1) ?? "");
  }
  return heard;
}

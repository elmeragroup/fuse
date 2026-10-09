import type { DensityAttributes, ThemeAttributes } from "@elmeragroup/fuse/theme";

const HTML_OPEN_TAG = /<html\b[^>]*>/i;

export function applyHostRootAttributes(
  html: string,
  attributes: ThemeAttributes,
  density: DensityAttributes
): string {
  const open = HTML_OPEN_TAG.exec(html);
  if (open === null) {
    throw new Error("Vite HTML is missing the <html> tag");
  }

  const tag = open[0];
  const stamped = Object.entries({ ...attributes, ...density });
  for (const [name] of stamped) {
    if (new RegExp(`\\s${name}=`, "i").test(tag)) {
      throw new Error(
        `Vite HTML must not already contain ${name}; the adapter stamps brand and density attributes onto <html>.`
      );
    }
  }

  const next = tag.replace(/>$/, `${stamped.map(([name, value]) => ` ${name}="${value}"`).join("")}>`);
  return `${html.slice(0, open.index)}${next}${html.slice(open.index + open[0].length)}`;
}

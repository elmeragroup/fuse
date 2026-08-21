const HTML_OPEN_TAG = /<html\b[^>]*>/i;

const HOST_ROOT_ATTRIBUTE_NAMES = [
  "data-theme-variant",
  "data-theme-brand",
  "data-theme-segment",
  "data-density",
] as const;

const HOST_ROOT_ATTRIBUTE_PATTERNS = HOST_ROOT_ATTRIBUTE_NAMES.map((name) => ({
  name,
  pattern: new RegExp(`\\s${name}=`, "i"),
}));

export type HostRootBrandAttributes = {
  "data-theme-variant": string;
  "data-theme-brand": string;
  "data-theme-segment": string;
};

export type HostRootDensityAttributes = {
  "data-density": string;
};

export function applyHostRootAttributes(
  html: string,
  attributes: HostRootBrandAttributes,
  density: HostRootDensityAttributes
): string {
  const open = HTML_OPEN_TAG.exec(html);
  if (open === null) {
    throw new Error("Vite HTML is missing the <html> tag");
  }

  const tag = open[0];
  for (const { name, pattern } of HOST_ROOT_ATTRIBUTE_PATTERNS) {
    if (pattern.test(tag)) {
      throw new Error(
        `Vite HTML must not already contain ${name}; the adapter stamps brand and density attributes onto <html>.`
      );
    }
  }

  const next = tag.replace(
    />$/,
    ` data-theme-variant="${attributes["data-theme-variant"]}" data-theme-brand="${attributes["data-theme-brand"]}" data-theme-segment="${attributes["data-theme-segment"]}" data-density="${density["data-density"]}">`
  );
  return `${html.slice(0, open.index)}${next}${html.slice(open.index + open[0].length)}`;
}

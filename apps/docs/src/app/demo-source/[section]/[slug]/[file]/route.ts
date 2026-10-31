import { highlightSource } from "../../../../../components/docs-code-block";
import { demoLocations, readDemoSource } from "../../../../../lib/demo-source";
import type { DemoLocation } from "../../../../../lib/demo-source";

/**
 * The highlighted markup of one demo's source, which the demo frame's Code view fetches the first
 * time it shows. Every demo prerenders here at build time, so the highlighter stays on the server
 * and a page ships each source once, as plain text.
 */
export function generateStaticParams(): DemoLocation[] {
  return demoLocations();
}

/** Every demo's location as one key, scanned once per server, which guards the params. */
let known: ReadonlyMap<string, DemoLocation> | null = null;

function locationKey(section: string, slug: string, file: string): string {
  return `${section}/${slug}/${file}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ section: string; slug: string; file: string }> }
): Promise<Response> {
  const { section, slug, file } = await context.params;
  known ??= new Map(
    demoLocations().map((location) => [locationKey(location.section, location.slug, location.file), location])
  );
  const location = known.get(locationKey(section, slug, file));
  if (location === undefined) return new Response(null, { status: 404 });
  return new Response(highlightSource(readDemoSource(location).source), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

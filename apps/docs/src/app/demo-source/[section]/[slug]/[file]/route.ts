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

export async function GET(
  _request: Request,
  context: { params: Promise<{ section: string; slug: string; file: string }> }
): Promise<Response> {
  const { section, slug, file } = await context.params;
  const known = demoLocations().find(
    (location) => location.section === section && location.slug === slug && location.file === file
  );
  if (known === undefined) return new Response(null, { status: 404 });
  return new Response(highlightSource(readDemoSource(known).source), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

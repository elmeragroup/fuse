import type { ReactElement } from "react";

import { CONTENT_COMPONENTS, DEMO_COMPONENTS } from "../generated/modules";
import type { DocsComponent } from "../lib/docs-model";
import { API_SECTION_ID, apiPartAnchor, TOKENS_SECTION_ID } from "../lib/nav";
import { ApiTable } from "./ApiTable";
import "./ComponentPage.css";
import { DemoFrame } from "./DemoFrame";
import { InlineCode } from "./InlineCode";
import { MetaLinks } from "./MetaLinks";
import { TokensConsumed } from "./TokensConsumed";

export type ComponentPageProps = {
  component: DocsComponent;
};

/**
 * The §3.4 component-page anatomy, top to bottom: H1 + lede, the meta links, the MDX
 * shell's own prose, one demo frame per spec §10 scenario, the generated API tables,
 * and the generated Tokens-consumed section. Everything below the prose is generated.
 */
export function ComponentPage({ component }: ComponentPageProps): ReactElement {
  const Content = CONTENT_COMPONENTS.get(component.slug);

  return (
    <>
      <h1>{component.title}</h1>
      <p className="DocsLede">
        <InlineCode text={component.lede} />
      </p>
      <MetaLinks
        markdownUrl={component.markdownUrl}
        sourceUrl={component.sourceUrl}
        sourcePath={component.sourcePath}
      />
      <p className="ComponentImport">
        <code>{`import { ${component.parts[0]?.name.split(".")[0] ?? component.title} } from "${component.entry}";`}</code>
        <span className="ComponentRsc">{component.rsc}</span>
      </p>
      {component.hasContent && Content !== undefined ? (
        <div className="ComponentProse">
          <Content />
        </div>
      ) : null}

      {component.demos.map((demo) => {
        const Demo = DEMO_COMPONENTS.get(`${component.slug}/${demo.id}`);
        return Demo === undefined ? null : (
          <DemoFrame
            key={demo.id}
            id={demo.id}
            title={demo.title}
            highlighted={demo.highlighted}
            sourcePath={demo.sourcePath}>
            <Demo />
          </DemoFrame>
        );
      })}

      <section aria-labelledby={API_SECTION_ID}>
        <h2 className="ComponentSectionHeading" id={API_SECTION_ID}>
          API reference
        </h2>
        {component.parts.map((part) => (
          <ApiTable key={part.name} part={part} id={apiPartAnchor(part.name)} />
        ))}
      </section>

      <TokensConsumed id={TOKENS_SECTION_ID} tokens={component.tokens} />
    </>
  );
}

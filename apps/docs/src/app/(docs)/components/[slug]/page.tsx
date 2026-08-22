import type { ReactElement } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComponentPage } from "../../../../components/ComponentPage";
import { DOCS_COMPONENTS } from "../../../../generated/registry";
import { componentBySlug } from "../../../../lib/nav";

export const dynamicParams = false;

type RouteParams = {
  slug: string;
};

export type ComponentRouteProps = {
  params: Promise<RouteParams>;
};

export function generateStaticParams(): RouteParams[] {
  return DOCS_COMPONENTS.map((component) => ({ slug: component.slug }));
}

export async function generateMetadata({ params }: ComponentRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const component = componentBySlug(slug);
  if (component === undefined) {
    return {};
  }
  return { title: component.title, description: component.lede };
}

export default async function ComponentRoute({ params }: ComponentRouteProps): Promise<ReactElement> {
  const { slug } = await params;
  const component = componentBySlug(slug);
  if (component === undefined) {
    notFound();
  }
  return <ComponentPage component={component} />;
}

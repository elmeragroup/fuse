import { startDocsProductionServer } from "./docs-server";

export default async function globalSetup(): Promise<() => Promise<void>> {
  const server = await startDocsProductionServer();
  process.env.DOCS_BASE_URL = server.url;
  return async () => {
    await server.close();
  };
}

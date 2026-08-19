import { startStaticThemeServer } from "./server";

export default async function globalSetup(): Promise<() => Promise<void>> {
  const server = await startStaticThemeServer();
  process.env.STATIC_THEME_BASE_URL = server.url;
  return async () => {
    await server.close();
  };
}

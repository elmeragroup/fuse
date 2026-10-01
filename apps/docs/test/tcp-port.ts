import { createServer } from "node:net";
import type { AddressInfo } from "node:net";

/**
 * Asks the OS for a free loopback TCP port, shared by the docs and static-theme test
 * servers. Docs-agnostic on purpose, like `suite-browser.ts`: the static-theme server
 * borrows it without loading the docs server module.
 */
export async function reservePort(): Promise<number> {
  const server = createServer();
  return await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = listeningPort(address);
      if (port === null) {
        server.close();
        reject(new Error("Could not reserve a TCP port"));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function listeningPort(address: AddressInfo | string | null): number | null {
  if (address === null || !isAddressInfo(address)) {
    return null;
  }
  return address.port;
}

function isAddressInfo(address: AddressInfo | string): address is AddressInfo {
  return address instanceof Object && Object.hasOwn(address, "port");
}

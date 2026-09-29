export * from "./types.js";
export { OblivionError } from "./errors.js";
import { OblivionError } from "./errors.js";
export class OblivionClient {
  constructor(..._args: unknown[]) {
    throw new OblivionError(
      "SERVER_ONLY",
      "API credentials are server-only. Import @oblivion-protocol/sdk/wallet in browsers.",
    );
  }
}

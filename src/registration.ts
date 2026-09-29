import { Transport } from "./transport.js";
import { address, response, token } from "./validate.js";
import { invalid } from "./errors.js";
import type {
  TransportOptions,
  RequestOptions,
  RegistrationAction,
  RegistrationConfig,
  Challenge,
  RegistrationSession,
  IssuedKey,
  Hex,
} from "./types.js";
export type {
  RegistrationAction,
  RegistrationConfig,
  Challenge,
  RegistrationSession,
  IssuedKey,
  TransportOptions,
  RequestOptions,
} from "./types.js";
export { OblivionError } from "./errors.js";
/** Public wallet-authenticated endpoints. Never pays, signs or rotates automatically. */
export class RegistrationClient {
  #transport: Transport;
  constructor(options: TransportOptions = {}) {
    this.#transport = new Transport(options);
  }
  async config(wallet: string, options?: RequestOptions) {
    if (!address(wallet)) invalid("Invalid wallet address.");
    const r = await this.#transport.request<RegistrationConfig>(
      "/registration/config?wallet=" + wallet,
      undefined,
      options,
    );
    response(
      r.chainId === 4663 &&
        address(r.address) &&
        r.request?.to?.toLowerCase() === r.address.toLowerCase(),
    );
    return r;
  }
  async challenge(
    wallet: string,
    action: RegistrationAction,
    options?: RequestOptions,
  ) {
    if (!address(wallet) || !["issue", "rotate", "revoke"].includes(action))
      invalid("Invalid wallet or registration action.");
    const r = await this.#transport.request<Challenge>(
      "/registration/challenge",
      { wallet, action },
      options,
    );
    response(
      typeof r.challenge === "string" &&
        typeof r.message === "string" &&
        Number.isFinite(r.expiresAt),
    );
    return r;
  }
  async authenticate(
    challenge: string,
    signature: Hex,
    options?: RequestOptions,
  ) {
    token(challenge);
    if (!/^0x[0-9a-f]{130}$/i.test(signature))
      invalid("A wallet message signature is required.");
    const r = await this.#transport.request<RegistrationSession>(
      "/registration/authenticate",
      { challenge, signature },
      options,
    );
    response(typeof r.session === "string" && address(r.wallet));
    return r;
  }
  async issueKey(session: string, options?: RequestOptions) {
    token(session);
    const r = await this.#transport.request<IssuedKey>(
      "/registration/key",
      { session },
      options,
    );
    response(
      (typeof r.apiKey === "string" || r.apiKey === null) &&
        address(r.wallet) &&
        typeof r.revoked === "boolean",
    );
    return r;
  }
}

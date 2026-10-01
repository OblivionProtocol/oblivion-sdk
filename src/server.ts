import { Transport } from "./transport.js";
import { invalid } from "./errors.js";
import {
  address,
  quoteInput,
  response,
  token,
  transaction,
  uint,
} from "./validate.js";
import type {
  TransportOptions,
  RequestOptions,
  Features,
  Asset,
  Balances,
  QuoteInput,
  Quote,
  Approval,
  Simulation,
  Prepared,
  TransactionStatus,
  Hex,
  Erc20TokenResult,
} from "./types.js";
export * from "./types.js";
export { OblivionError } from "./errors.js";
/** Server-only bearer-authenticated API client. Never signs or broadcasts. */
export class OblivionClient {
  #transport: Transport;
  constructor(options: TransportOptions & { apiKey: string }) {
    if (typeof window !== "undefined")
      invalid(
        "API credentials are server-only. Use the wallet entry point in browsers.",
      );
    if (
      !options ||
      typeof options.apiKey !== "string" ||
      !/^\S{32,256}$/.test(options.apiKey)
    )
      invalid("A valid server-side API key is required.");
    this.#transport = new Transport(options, options.apiKey);
  }
  async features(options?: RequestOptions) {
    const r = await this.#transport.request<Features>(
      "/v1/features",
      undefined,
      options,
    );
    response(
      r.chainId === 4663 &&
        Array.isArray(r.methods) &&
        r.serverSigns === false &&
        r.serverBroadcasts === false,
    );
    return r;
  }
  async assets(options?: RequestOptions) {
    const r = await this.#transport.request<{ chainId: 4663; assets: Asset[] }>(
      "/v1/assets",
      undefined,
      options,
    );
    response(r.chainId === 4663 && Array.isArray(r.assets));
    return r;
  }
  async balances(wallet: string, options?: RequestOptions) {
    if (!address(wallet)) invalid("Invalid wallet address.");
    const r = await this.#transport.request<Balances>(
      "/v1/balances?address=" + wallet,
      undefined,
      options,
    );
    response(
      r.chainId === 4663 &&
        r.sender?.toLowerCase() === wallet.toLowerCase() &&
        uint(r.ethWei) &&
        Array.isArray(r.assets),
    );
    return r;
  }
  async erc20Token(
    contract: string,
    sender?: string,
    options?: RequestOptions,
  ) {
    if (!address(contract) || (sender !== undefined && !address(sender)))
      invalid("Invalid token or wallet address.");
    const r = await this.#transport.request<Erc20TokenResult>(
      "/v1/erc20/token?address=" +
        contract +
        (sender ? "&sender=" + sender : ""),
      undefined,
      options,
    );
    response(
      r.chainId === 4663 &&
        address(r.token?.address) &&
        r.token.address.toLowerCase() === contract.toLowerCase() &&
        Number.isInteger(r.token.decimals) &&
        r.token.decimals >= 0 &&
        r.token.decimals <= 36 &&
        (r.balanceRaw === undefined || uint(r.balanceRaw)),
    );
    return r;
  }
  async quote(input: QuoteInput, options?: RequestOptions) {
    quoteInput(input);
    const r = await this.#transport.request<Quote>(
      "/v1/quotes",
      input,
      options,
    );
    response(
      typeof r.quote === "string" &&
        address(r.executor) &&
        uint(r.nativeValueWei) &&
        Array.isArray(r.payouts),
    );
    return r;
  }
  async prepareApproval(quote: string, options?: RequestOptions) {
    token(quote);
    const r = await this.#transport.request<Approval>(
      "/v1/approvals/prepare",
      { quote },
      options,
    );
    response(typeof r.complete === "boolean");
    if (!r.complete) {
      transaction(r.request);
      response(address(r.request.to) && r.request.value === "0x0");
    }
    return r;
  }
  async simulate(quote: string, options?: RequestOptions) {
    token(quote);
    const r = await this.#transport.request<Simulation>(
      "/v1/simulations",
      { quote },
      options,
    );
    transaction(r.request);
    response(r.request.to === undefined && typeof r.simulation === "string");
    return r;
  }
  async prepare(simulation: string, options?: RequestOptions) {
    token(simulation);
    const r = await this.#transport.request<Prepared>(
      "/v1/transactions/prepare",
      { simulation },
      options,
    );
    transaction(r.request);
    response(r.request.to === undefined && typeof r.tracking === "string");
    return r;
  }
  async track(tracking: string, hash: Hex, options?: RequestOptions) {
    token(tracking);
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) invalid("Invalid transaction hash.");
    const r = await this.#transport.request<{hash: Hex; registered: true; state: "queued" | "confirmed" | "reverted" | "failed" | "expired"}>(
      "/v1/transactions/track", { tracking, hash }, options,
    );
    response(r.registered === true && r.hash?.toLowerCase() === hash.toLowerCase() &&
      ["queued","confirmed","reverted","failed","expired"].includes(r.state));
    return r;
  }
  async status(tracking: string, hash: Hex, options?: RequestOptions) {
    token(tracking);
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) invalid("Invalid transaction hash.");
    const r = await this.#transport.request<TransactionStatus>(
      "/v1/transactions/status",
      { tracking, hash },
      options,
    );
    response(
      ["unknown", "pending", "confirming", "reverted", "confirmed"].includes(
        r.status,
      ),
    );
    if (r.status === "confirmed")
      response(
        r.hash?.toLowerCase() === hash.toLowerCase() &&
          uint(r.feePaidWei) &&
          Array.isArray(r.payouts),
      );
    return r;
  }
}

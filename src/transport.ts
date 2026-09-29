import { OblivionError, invalid } from "./errors.js";
import { object } from "./validate.js";
import type { RequestOptions, TransportOptions } from "./types.js";
const errorCodes = new Set([
  "ADDRESS_COLLISION",
  "APPROVAL_REQUIRED",
  "ASSET_CHANGED",
  "BODY_LIMIT",
  "BUSY",
  "CHALLENGE_EXPIRED",
  "CHALLENGE_USED",
  "CONFIG_CHANGED",
  "CONTENT_TYPE",
  "DUST",
  "EXPIRED",
  "FEE_NOT_VERIFIED",
  "GAS_LIMIT",
  "INITCODE_LIMIT",
  "INSUFFICIENT_ETH",
  "INSUFFICIENT_TOKEN",
  "INVALID_ACTION",
  "INVALID_ADDRESS",
  "INVALID_ALLOCATION",
  "INVALID_AMOUNT",
  "INVALID_ASSETS",
  "INVALID_CHALLENGE",
  "INVALID_HASH",
  "INVALID_INPUT",
  "INVALID_JSON",
  "INVALID_METHOD",
  "INVALID_ORIGIN",
  "INVALID_PERCENTAGE",
  "INVALID_RECIPIENT",
  "INVALID_RECIPIENTS",
  "INVALID_ROUTE",
  "INVALID_SEED",
  "INVALID_SIGNATURE",
  "INVALID_TOKEN",
  "INVALID_WALLET",
  "KEY_EXISTS",
  "METHOD_NOT_ALLOWED",
  "NONCE_CHANGED",
  "NOT_AVAILABLE",
  "NOT_FOUND",
  "NO_APPROVAL",
  "PENDING_NONCE",
  "PREFLIGHT_FAILED",
  "RATE_LIMIT",
  "REGISTRATION_PENDING",
  "REGISTRY_UNAVAILABLE",
  "RPC_UNAVAILABLE",
  "SESSION_EXPIRED",
  "SESSION_USED",
  "TRANSACTION_MISMATCH",
  "UNAUTHORIZED",
  "UNSUPPORTED_ASSET",
  "UNSUPPORTED_WALLET",
  "WRONG_CHAIN",
]);
export class Transport {
  #key?: string;
  #url: string;
  #fetch: typeof fetch;
  #timeout: number;
  constructor(options: TransportOptions = {}, key?: string) {
    let url: URL;
    try {
      url = new URL(options.baseUrl || "https://oblivion-protocol.com/api");
    } catch {
      invalid("Invalid API base URL.");
    }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !(
        url.protocol === "https:" ||
        (url.protocol === "http:" &&
          local &&
          options.allowInsecureLocalhost === true)
      )
    )
      invalid(
        "Use HTTPS without URL credentials, query parameters or fragments.",
      );
    if (
      options.timeoutMs !== undefined &&
      (!Number.isInteger(options.timeoutMs) ||
        options.timeoutMs < 1 ||
        options.timeoutMs > 120000)
    )
      invalid("Timeout must be 1–120000 milliseconds.");
    this.#url = url.href.replace(/\/$/, "");
    this.#key = key;
    this.#fetch = options.fetch || globalThis.fetch;
    this.#timeout = options.timeoutMs ?? 30000;
  }
  async request<T>(
    path: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeout);
    try {
      const r = await this.#fetch(this.#url + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(this.#key ? { Authorization: "Bearer " + this.#key } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
        credentials: "omit",
      });
      if (r.redirected)
        throw new OblivionError(
          "REDIRECT_BLOCKED",
          "Redirected API responses are not accepted.",
        );
      const raw = r.body?.getReader();
      let size = 0,
        text = "";
      const decoder = new TextDecoder();
      if (raw) {
        try {
          while (true) {
            const chunk = await raw.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 2097152) {
              await raw.cancel();
              throw new OblivionError(
                "INVALID_RESPONSE",
                "API response exceeded the size limit.",
              );
            }
            text += decoder.decode(chunk.value, { stream: true });
          }
          text += decoder.decode();
        } finally {
          raw.releaseLock();
        }
      }
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new OblivionError(
          "INVALID_RESPONSE",
          "API returned invalid JSON.",
          r.status,
        );
      }
      if (!r.ok) {
        const code =
          object(data) &&
          object(data.error) &&
          typeof data.error.code === "string" &&
          errorCodes.has(data.error.code)
            ? data.error.code
            : "API_ERROR";
        const retry = r.headers.get("retry-after");
        const seconds =
          retry && /^\d{1,6}$/.test(retry) ? Number(retry) : undefined;
        throw new OblivionError(
          code,
          "API request failed. Check the error code and documentation.",
          r.status,
          seconds,
        );
      }
      if (!object(data))
        throw new OblivionError(
          "INVALID_RESPONSE",
          "API response must be an object.",
        );
      return data as T;
    } catch (e) {
      if (e instanceof OblivionError) throw e;
      if (controller.signal.aborted)
        throw new OblivionError(
          timedOut ? "TIMEOUT" : "ABORTED",
          timedOut
            ? "API request timed out. Reconcile before retrying."
            : "API request was cancelled.",
        );
      throw new OblivionError(
        "NETWORK_ERROR",
        "API request failed. No automatic retry was performed.",
      );
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }
}

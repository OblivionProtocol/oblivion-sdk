import { invalid, OblivionError } from "./errors.js";
import type { QuoteInput, TransactionRequest } from "./types.js";
export const address = (v: unknown): v is `0x${string}` =>
  typeof v === "string" && /^0x[0-9a-f]{40}$/i.test(v);
export const hex = (v: unknown): v is `0x${string}` =>
  typeof v === "string" && /^0x(?:[0-9a-f]{2})*$/i.test(v);
export const quantity = (v: unknown): v is `0x${string}` =>
  typeof v === "string" && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(v);
export const uint = (v: unknown): v is string =>
  typeof v === "string" && /^(0|[1-9][0-9]*)$/.test(v);
export function object(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
export function token(v: unknown) {
  if (typeof v !== "string" || !v.length || v.length > 16000)
    invalid("A valid opaque token is required.");
}
export function decimal(v: unknown, decimals = 18): bigint {
  if (
    typeof v !== "string" ||
    !new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(v) ||
    v.length > 100
  )
    invalid(
      `Amounts must be positive decimal strings, with at most ${decimals} decimals.`,
    );
  const [a, b = ""] = v.split(".");
  const n =
    BigInt(a) * 10n ** BigInt(decimals) + BigInt(b.padEnd(decimals, "0"));
  if (n <= 0n || n >= 2n ** 256n)
    invalid("Amount is outside the supported range.");
  return n;
}
export function quoteInput(v: QuoteInput) {
  if (!object(v) || !address(v.sender) || BigInt(v.sender) === 0n)
    invalid("A valid sender is required.");
  if (
    v.seed !== undefined &&
    !(typeof v.seed === "string" && /^0x[0-9a-f]{64}$/i.test(v.seed))
  )
    invalid("Seed must be bytes32.");
  const asset = (v as any).asset;
  if (asset === "ERC20") {
    if (
      v.method !== "abstraction" ||
      !address((v as any).token) ||
      BigInt((v as any).token) === 0n
    )
      invalid("ERC20 requires an abstraction token contract address.");
    if (
      !address(v.recipient) ||
      BigInt(v.recipient) === 0n ||
      v.recipient.toLowerCase() === v.sender.toLowerCase()
    )
      invalid("Invalid recipient.");
    if (
      typeof v.amount !== "string" ||
      !/^\d{1,78}(\.\d{1,36})?$/.test(v.amount) ||
      BigInt(v.amount.replace(".", "")) <= 0n
    )
      invalid(
        "Use a positive decimal amount; the API checks the token's exact precision.",
      );
    return;
  }
  if ("token" in v) invalid("token is only valid with asset ERC20.");

  if (
    asset !== undefined &&
    (v.method === "rwa" || !["ETH", "USDG"].includes(asset))
  )
    invalid("Unsupported transfer asset.");
  const decimals = asset === "USDG" ? 6 : 18;
  if (v.method === "multisend") {
    if (asset === "USDG" && v.route === "direct")
      invalid("USDG multi-send supports abstraction or mesh.");
    if (
      !Array.isArray(v.recipients) ||
      v.recipients.length < 2 ||
      v.recipients.length > 100 ||
      v.recipients.some(
        (r) =>
          !address(r) ||
          BigInt(r) === 0n ||
          r.toLowerCase() === v.sender.toLowerCase(),
      ) ||
      new Set(v.recipients.map((r) => r.toLowerCase())).size !==
        v.recipients.length
    )
      invalid("Use 2–100 distinct valid recipients.");
    if (
      !["direct", "abstraction", "mesh"].includes(v.route) ||
      !object(v.allocation)
    )
      invalid("Invalid multi-send route or allocation.");
    if (v.allocation.mode === "fixed") decimal(v.allocation.amount, decimals);
    else if (v.allocation.mode === "random") {
      if (
        decimal(v.allocation.min, decimals) >
        decimal(v.allocation.max, decimals)
      )
        invalid("Minimum exceeds maximum.");
    } else invalid("Invalid allocation mode.");
  } else {
    if (
      !address(v.recipient) ||
      BigInt(v.recipient) === 0n ||
      v.recipient.toLowerCase() === v.sender.toLowerCase()
    )
      invalid("A valid destination different from sender is required.");
    if (v.method === "abstraction" || v.method === "mesh")
      decimal(v.amount, decimals);
    else if (v.method === "rwa") {
      const symbols = [
        "NVDA",
        "AAPL",
        "TSLA",
        "MSFT",
        "AMZN",
        "GOOGL",
        "META",
        "SPY",
        "MSTR",
        "QQQ",
        "AMD",
      ];
      if (!Array.isArray(v.items) || v.items.length < 1 || v.items.length > 10)
        invalid("Use 1–10 supported assets.");
      const seen = new Set();
      for (const item of v.items) {
        if (
          !object(item) ||
          !symbols.includes(item.symbol) ||
          seen.has(item.symbol)
        )
          invalid("Unsupported or duplicate asset.");
        seen.add(item.symbol);
        if (item.amount !== undefined) {
          if (item.percentage !== undefined)
            invalid("Choose amount or percentage.");
          decimal(item.amount);
        } else if (![25, 50, 75, 100].includes(item.percentage))
          invalid("Use 25, 50, 75 or 100 percent.");
      }
    } else invalid("Unsupported transfer method.");
  }
}
export function transaction(v: unknown): asserts v is TransactionRequest {
  if (
    !object(v) ||
    !address(v.from) ||
    !hex(v.data) ||
    v.data === "0x" ||
    !quantity(v.chainId) ||
    BigInt(v.chainId) !== 4663n ||
    !quantity(v.value) ||
    !quantity(v.nonce) ||
    !quantity(v.gas) ||
    BigInt(v.gas) === 0n ||
    (v.gasPrice !== undefined && !quantity(v.gasPrice)) ||
    (v.to !== undefined && !address(v.to))
  )
    throw new OblivionError("INVALID_RESPONSE", "Invalid transaction request.");
  const allowed = [
    "from",
    "to",
    "data",
    "value",
    "nonce",
    "gas",
    "gasPrice",
    "chainId",
  ];
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    throw new OblivionError(
      "INVALID_RESPONSE",
      "Unexpected transaction fields.",
    );
}
export function response(condition: unknown): asserts condition {
  if (!condition)
    throw new OblivionError(
      "INVALID_RESPONSE",
      "API response did not match the expected format.",
    );
}

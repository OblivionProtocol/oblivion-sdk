import { transaction, address, quantity, token } from "./validate.js";
import { OblivionError, invalid } from "./errors.js";
import type {
  WalletProvider,
  TransactionRequest,
  Address,
  Hex,
} from "./types.js";
export type {
  WalletProvider,
  TransactionRequest,
  Address,
  Hex,
} from "./types.js";
export { OblivionError } from "./errors.js";
export interface TransactionReview {
  account: Address;
  kind: "execution" | "approval";
  valueWei: string;
  data: Hex;
  nonce: Hex;
  to?: Address;
}
/** Call only from an explicit user confirmation. Never retries a wallet submission. */
export async function sendReviewedTransaction(
  provider: WalletProvider,
  request: TransactionRequest,
  review: TransactionReview,
): Promise<Hex> {
  transaction(request);
  if (
    !address(review.account) ||
    !/^\d+$/.test(review.valueWei) ||
    !quantity(review.nonce)
  )
    invalid("Invalid transaction review.");
  if (
    request.from.toLowerCase() !== review.account.toLowerCase() ||
    BigInt(request.value) !== BigInt(review.valueWei) ||
    request.data.toLowerCase() !== review.data?.toLowerCase() ||
    request.nonce.toLowerCase() !== review.nonce.toLowerCase()
  )
    invalid("Transaction differs from the reviewed request.");
  if (review.kind === "execution") {
    if (request.to !== undefined || review.to !== undefined)
      invalid("Execution must be a creation transaction.");
  } else if (review.kind === "approval") {
    if (
      !address(review.to) ||
      request.to?.toLowerCase() !== review.to.toLowerCase() ||
      BigInt(request.value) !== 0n
    )
      invalid("Approval destination or value mismatch.");
  } else invalid("Invalid transaction kind.");
  // Snapshot before awaiting the wallet so caller mutation cannot change what is sent.
  const tx = { ...request };
  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    if (
      !Array.isArray(accounts) ||
      typeof accounts[0] !== "string" ||
      accounts[0].toLowerCase() !== tx.from.toLowerCase()
    )
      throw new OblivionError(
        "WRONG_ACCOUNT",
        "Connect the reviewed sender wallet.",
      );
    const chain = await provider.request({ method: "eth_chainId" });
    if (!quantity(chain) || BigInt(chain) !== 4663n)
      throw new OblivionError(
        "WRONG_CHAIN",
        "Switch the wallet to chain 4663 before continuing.",
      );
    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
    if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash))
      throw new OblivionError(
        "SUBMISSION_UNKNOWN",
        "Wallet returned no valid hash. Reconcile wallet activity before retrying.",
      );
    return hash as Hex;
  } catch (e) {
    if (e instanceof OblivionError) throw e;
    throw new OblivionError(
      "WALLET_ERROR",
      "Wallet request did not complete. Check wallet activity before retrying.",
    );
  }
}

/** Execution-only helper. register must call your backend, never expose a partner API key.
 * A registration failure returns the already-broadcast hash and never resubmits funds.
 */
export async function sendTrackedTransaction(
  provider: WalletProvider,
  prepared: { request: TransactionRequest; tracking: string },
  review: TransactionReview,
  register: (submission: {tracking: string; hash: Hex}) => Promise<{registered: true; hash: Hex}>,
): Promise<{ hash: Hex; tracking: string; trackingRegistered: boolean }> {
  if (review.kind !== "execution" || typeof register !== "function")
    invalid("Tracking requires an execution review and a registration callback.");
  token(prepared.tracking);
  const tracking = prepared.tracking;
  const hash = await sendReviewedTransaction(provider, prepared.request, review);
  try {
    const result = await register({tracking,hash});
    return {hash,tracking,trackingRegistered: result?.registered === true && result.hash?.toLowerCase() === hash.toLowerCase()};
  } catch {
    return {hash,tracking,trackingRegistered:false};
  }
}

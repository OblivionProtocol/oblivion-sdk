export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type AssetSymbol =
  | "NVDA"
  | "AAPL"
  | "TSLA"
  | "MSFT"
  | "AMZN"
  | "GOOGL"
  | "META"
  | "SPY"
  | "MSTR"
  | "QQQ"
  | "AMD";
export type TokenSymbol = AssetSymbol | "USDG";
export type TransferAsset = "ETH" | "USDG";
export type Method = "abstraction" | "mesh" | "multisend" | "rwa";
export type QuoteInput = { sender: Address; seed?: Hex } & (
  | {
      method: "abstraction" | "mesh";
      asset?: TransferAsset;
      recipient: Address;
      amount: string;
    }
  | {
      method: "multisend";
      asset?: TransferAsset;
      recipients: Address[];
      route: "direct" | "abstraction" | "mesh";
      allocation:
        | { mode: "fixed"; amount: string }
        | { mode: "random"; min: string; max: string };
    }
  | {
      method: "rwa";
      recipient: Address;
      items: ({ symbol: AssetSymbol } & (
        | { amount: string; percentage?: never }
        | { percentage: 25 | 50 | 75 | 100; amount?: never }
      ))[];
    }
);
export interface Fee {
  asset: "ETH";
  amount: string;
  wei: string;
  recipient: Address;
  basis: string;
}
export interface Features {
  version: string;
  chainId: 4663;
  methods: Method[];
  transferAssets?: TransferAsset[];
  usdgMultisendRoutes?: ("abstraction" | "mesh")[];
  fee: Fee;
  approvalsCharged: boolean;
  gasIncluded: boolean;
  serverSigns: false;
  serverBroadcasts: false;
}
export interface Asset {
  symbol: TokenSymbol;
  name: string;
  address: Address;
  decimals: number;
}
export interface Balances {
  sender: Address;
  chainId: 4663;
  ethWei: string;
  assets: (
    | { symbol: TokenSymbol; address: Address; raw: string; decimals: number }
    | { symbol: TokenSymbol; raw: null; error: "BALANCE_UNAVAILABLE" }
  )[];
}
export type Payout =
  | { recipient: Address; amountWei: string }
  | {
      recipient: Address;
      symbol: TokenSymbol;
      amount: string;
      amountRaw?: string;
      decimals?: number;
    };
export interface TransactionRequest {
  from: Address;
  chainId: Hex;
  data: Hex;
  value: Hex;
  nonce: Hex;
  gas: Hex;
  gasPrice?: Hex;
  to?: Address;
}
export interface Quote {
  quote: string;
  quoteId: string;
  expiresInSeconds: number;
  executor: Address;
  fee: Fee;
  nativeValueWei: string;
  payouts: Payout[];
  approvalCount: number;
  approvals: {
    symbol: TokenSymbol;
    spender: Address;
    amountRaw: string;
    nonce: Hex;
  }[];
  note: string;
}
export interface Prepared {
  request: TransactionRequest;
  executor: Address;
  payouts: Payout[];
  feeWei: string;
  maxGasCostWei: string;
  block: Hex;
  tracking: string;
  instruction: string;
}
export interface Simulation extends Omit<Prepared, "tracking" | "instruction"> {
  simulation: string;
  expiresInSeconds: number;
}
export type Approval =
  | { complete: true }
  | {
      complete: false;
      index: number;
      symbol: TokenSymbol;
      feeWei: "0";
      request: TransactionRequest;
      warning: string;
    };
export type TransactionStatus =
  | { status: "unknown" | "pending" | "confirming"; feePaidWei: null }
  | { status: "reverted"; feePaidWei: "0"; payouts: [] }
  | {
      status: "confirmed";
      hash: Hex;
      block: Hex;
      feePaidWei: string;
      payouts: Payout[];
    };
export interface RequestOptions {
  signal?: AbortSignal;
}
export interface TransportOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  allowInsecureLocalhost?: boolean;
}
export interface WalletProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}
export type RegistrationAction = "issue" | "rotate" | "revoke";
export interface RegistrationConfig {
  chainId: 4663;
  address: Address;
  codeHash: Hex;
  feeWei: string;
  feeEth: string;
  receiver: Address;
  confirmations: number;
  requesterKey: Hex | null;
  hasApiKey: boolean;
  request: { to: Address; data: Hex; value: Hex; chainId: Hex };
}
export interface Challenge {
  challenge: string;
  message: string;
  expiresAt: number;
}
export interface RegistrationSession {
  session: string;
  expiresInSeconds: number;
  wallet: Address;
  action: RegistrationAction;
}
export interface IssuedKey {
  apiKey: string | null;
  requesterKey: Hex;
  wallet: Address;
  revoked: boolean;
  message: string;
}

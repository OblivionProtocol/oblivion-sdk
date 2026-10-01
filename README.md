# Oblivion Protocol SDK

TypeScript and JavaScript client for the Oblivion API on chain **4663**. Supports Abstraction, Reactive Mesh, Multi-send (fixed or random-in-range), and the eleven supported RWA assets. Version 0.1.4 is distributed through npm and GitHub Releases.

## Asset scope

| Workflow | ETH | USDG | Listed RWA tokens |
| --- | --- | --- | --- |
| Website Abstraction, Reactive Mesh and Multi-send | Supported | Supported | Use the RWA basket flow |
| Website RWA baskets | Not applicable | Not supported | Supported; up to 10 assets per basket |
| Signed invoice service (`/api/invoices/*`) | Supported | Supported | Not supported |
| Partner API with USDG bundle + SDK v0.1.2  | Supported | Supported | Supported |
| SDK v0.1.1 | Supported | Not supported | Supported |

The USDG integration adds `asset: "USDG"` to Partner Abstraction, Reactive Mesh and Multi-send quotes. Omitting `asset` retains ETH behavior. USDG has **6 decimals** and a **0.001024 USDG combined minimum**. Multi-send supports `abstraction` or `mesh`, with fixed or random-in-range allocation. USDG is a transfer asset, not an RWA basket symbol.

USDG requires SDK 0.1.2 and the updated API bundle. SDK 0.1.1 does not support USDG. Check `features().transferAssets` for `USDG` before enabling it; the backend only advertises USDG when its fee-enabled execution bundle is installed. The separate invoice service still uses wallet signatures; the SDK has no invoice-specific client.

Website and invoice USDG amounts use **6 decimals**, with a combined transfer minimum of **0.001024 USDG**. Users approve the exact token amount before simulation, then review and confirm execution. Both approval and execution require ETH for gas. These public flows have no platform fee. Partner API execution fees and developer registration fees are separate and paid in ETH. Partner USDG executions charge **0.00001 ETH**, in addition to gas. Approval is fee-free. Token payouts are not reduced by this ETH fee.

## USDG integration

```ts
const features = await api.features();
if (!features.transferAssets?.includes('USDG')) throw new Error('USDG unavailable');
const quote = await api.quote({
  method: 'abstraction', // or 'mesh'
  asset: 'USDG',
  sender,
  recipient,
  amount: '10.123456', // exact string, six decimals
});
const approval = await api.prepareApproval(quote.quote);
// Review the token address, predicted executor and exact amountRaw.
// The user confirms approval in their wallet; wait for a successful receipt.
// Then call prepareApproval again and require complete === true.
const simulation = await api.simulate(quote.quote);
// Only after the user selects Execute:
const prepared = await api.prepare(simulation.simulation);
// Review and sign prepared.request in the user wallet. Do not add a to address.
// Its native value includes the ETH API fee; do not add the fee a second time.
```

For USDG Multi-send use `method: 'multisend'`, `asset: 'USDG'`, `route: 'abstraction'` or `'mesh'`, and the existing fixed/random allocation fields. Each payout returns `symbol: 'USDG'`, decimal `amount`, integer `amountRaw` and `decimals: 6`. Allocations stay fixed across quote, simulation and prepare.

One approval is planned at the current wallet nonce; the transfer executor is predicted at the following nonce. Unrelated wallet transactions invalidate that plan. An exact allowance is required; do not use unlimited approval. Approval alone does not transfer USDG or pay the API fee. A reverted transfer preserves the prior approval; reconcile before issuing a new quote. Both steps need ETH for gas.

`assets()` and `balances()` include USDG separately from the eleven stock/ETF assets. Filter USDG out of RWA basket selectors. Settlement requires a matching transaction, canonical receipt with two L2 confirmations, the exact ETH fee event, and matching USDG completion/payout events. Two L2 confirmations do not imply L1 finality.

## Installation

Node.js 22 or newer for your backend. Install the SDK:

```sh
npm install @oblivion-protocol/sdk
```

The package includes compiled JavaScript and TypeScript declarations. You can also download the release tarball and checksum from [GitHub Releases](https://github.com/OblivionProtocol/oblivion-sdk/releases/tag/v0.1.4). Source checkouts require `npm ci && npm run build`.

Three entry points:

| Import | Purpose | Environment |
| --- | --- | --- |
| `@oblivion-protocol/sdk` | Authenticated transfer API | Backend only |
| `@oblivion-protocol/sdk/wallet` | Reviewed wallet submission | Frontend |
| `@oblivion-protocol/sdk/registration` | Registration and key lifecycle | Backend or frontend |

No runtime dependencies, contract sources, embedded execution bytecode, private keys, or preconfigured partner credentials. ESM, CommonJS and TypeScript declarations are included.

## Backend integration

```ts
import { OblivionClient } from '@oblivion-protocol/sdk';

const api = new OblivionClient({ apiKey: process.env.OBLIVION_API_KEY! });
const quote = await api.quote({
  method: 'abstraction', // or 'mesh'
  sender: '0x1111111111111111111111111111111111111111',
  recipient: '0x2222222222222222222222222222222222222222',
  amount: '0.01', // ETH decimal string; not USDG or a floating-point number
});
const simulation = await api.simulate(quote.quote);
// After the user reviews simulation and explicitly selects Execute:
const prepared = await api.prepare(simulation.simulation);
// Save prepared.tracking on your server. Return the unsigned request to the wallet.
```

Quotes last 60 minutes; simulations last 60 seconds. Prepare repeats the live preflight. Changing inputs requires a new quote and simulation. The API charges **0.00001 ETH per successful execution**, with network gas extra; simulations and approvals have no API execution fee. Values returned in transaction requests already include the API fee: do not add it again.

Authenticate and authorize your own frontend sessions, verify ownership of `sender`, bind quote/tracking tokens to the correct session, rate-limit your routes, and protect state-changing routes against CSRF. Do not build an unrestricted public proxy to your paid API account. Store keys only in a backend secret store/environment variable; never use `NEXT_PUBLIC_`, `VITE_`, browser storage, analytics, or client bundles. Redact opaque tokens, authorization headers and registration responses in your application logs.

## Multi-send and RWA

```ts
const multi = await api.quote({
  method: 'multisend', sender, recipients,
  route: 'mesh', // 'direct' | 'abstraction' | 'mesh'
  allocation: { mode: 'random', min: '0.001', max: '0.003' },
  // alternatively: allocation: { mode: 'fixed', amount: '0.002' }
});
const rwa = await api.quote({
  method: 'rwa', sender, recipient,
  items: [{ symbol: 'AAPL', percentage: 50 }, { symbol: 'NVDA', amount: '2' }],
});
```

Use `api.assets()` for the asset catalog and `api.balances(sender)` for native and individual asset balances. A failed asset balance is `raw: null`, not zero. Percentages supported: 25, 50, 75, 100. Supported assets: NVDA, AAPL, TSLA, MSFT, AMZN, GOOGL, META, SPY, MSTR, QQQ, AMD. AMD is supported starting with v0.1.1. The basket limit remains 10 assets.

RWA requires an approval for each selected asset, followed by one execution transaction. Call `api.prepareApproval(rwa.quote)`, review the exact spender/amount against the quote, have the wallet confirm it and wait for its receipt. Then request the next approval. Repeat until `{ complete: true }`, then simulate and prepare. Do not send approvals concurrently. Approvals are separate on-chain transactions and remain in place if execution fails. Changes to sender nonce or unrelated wallet transactions may invalidate the quote; do not reuse stale requests.

## Wallet confirmation

```ts
import { sendReviewedTransaction } from '@oblivion-protocol/sdk/wallet';

// Call only from the user's Execute action, after displaying payouts and costs.
const hash = await sendReviewedTransaction(window.ethereum, prepared.request, {
  account: connectedAddress,
  kind: 'execution',
  valueWei: displayedValueWei,
  data: reviewedRequest.data,
  nonce: reviewedRequest.nonce,
});
// Send hash to your backend; keep tracking there.
const status = await api.status(prepared.tracking, hash); // backend only
```

Keep an immutable copy of the reviewed request; creating the review from an unreviewed response is not independent validation. The helper checks sender, chain, value, calldata, nonce and whether a destination is allowed. It does not decode or audit the execution bytecode, certify a backend, or replace the wallet confirmation. For approvals use `kind: 'approval'`, `to: reviewedTokenAddress`, and `valueWei: '0'`; independently check the encoded approval spender and amount.

There is no automatic signing, chain switching, polling or transaction retry. Poll `status` on your backend no faster than once every 3 seconds per transaction, sharing the account-wide rate budget. Stop on `confirmed` or `reverted`; bound polling duration and reconcile an `unknown` result against the wallet. `confirming` is not final success. A timeout after wallet submission may still mean a transaction was broadcast: inspect wallet activity before retrying.

## Developer registration

```ts
import { RegistrationClient } from '@oblivion-protocol/sdk/registration';
const registration = new RegistrationClient();
const config = await registration.config(walletAddress);
const challenge = await registration.challenge(walletAddress, 'issue');
// Display and inspect the exact challenge message (wallet, domain, action, chain).
// Ask the connected wallet to sign it. Never reconstruct or modify the message.
const session = await registration.authenticate(challenge.challenge, signature);
const result = await registration.issueKey(session.session);
// Securely deliver result.apiKey to your backend secret store. Never log it.
```

A first registration requires a **0.01 ETH** on-chain payment plus gas and two confirmations before key issuance. Use the official developer portal or explicitly review and submit the current `config.request` with the wallet. The SDK does not submit this payment. Configuration is fetched dynamically; no registration or fee receiver address is embedded in the package. Challenges expire after five minutes; sessions after 30 minutes and are single-use. For rotation/revocation request the corresponding explicit action (`rotate` or `revoke`) and authenticate a new challenge; key issuance processes that action. Rotation invalidates the previous key; revocation returns no new key. Never retry a lost issuance/rotation response automatically: reconcile key state first.

## Errors and cancellation

All network methods accept a final `{ signal: AbortSignal }` argument. Client `timeoutMs` defaults to 30 seconds. `OblivionError` exposes `code`, optional HTTP `status` and `retryAfterSeconds`, without raw response bodies, request details or nested causes. There are no automatic retries, including rate limits. HTTPS is required; local HTTP is possible only for loopback hosts with explicit `allowInsecureLocalhost: true`. Redirects are refused.

Custom `baseUrl` and `fetch` are trusted configuration: they can receive your credential. The browser guard helps prevent accidental inclusion; it is not a substitute for deployment and bundle review. API results and transaction metadata can be sensitive, even though the SDK does not log them.

## Development and release

`npm ci`, `npm test`, `npm run check:public`, then `npm pack`. Tests use mocked transport and wallet fixtures; they do not spend funds or establish mainnet settlement. Review the exact tarball before release. The package currently retains its **UNLICENSED** designation; public source availability does not grant an open-source license.

[API documentation](https://oblivion-protocol.com/docs/) · [Developer registration](https://oblivion-protocol.com/developers/)

### Imported ERC-20 abstraction (SDK 0.1.3)

Requires a backend advertising `ERC20` in `features().transferAssets`. This does not add imported tokens to the curated RWA catalog. Only single-recipient Abstraction is supported initially.

```ts
const token = await client.erc20Token(tokenAddress, sender);
// Display token.token.address, symbol, decimals and token.balanceRaw to the user.
const quote = await client.quote({
  method: "abstraction",
  asset: "ERC20",
  token: tokenAddress,
  sender,
  recipient,
  amount: "1.234567", // Exact decimal string, within the imported token's precision.
});
```

Continue through exact approval → simulation → prepare → wallet confirmation → status. The minimum is 1024 raw units. Website transfers have no platform fee; API execution charges 0.00001 ETH plus gas. Taxed, rebasing, paused or otherwise nonstandard tokens may be incompatible. Importing is not an endorsement or security review. Discovery supports 0–36 decimals; the API rejects excess precision rather than rounding.


## Durable confirmation and activity counting (v0.1.4)

After the wallet broadcasts an execution, register its hash **once** through your backend:

```ts
await client.track(prepared.tracking, hash);
```

The server persists this registration and checks only that transaction until confirmed, reverted or expired. Confirmed payouts enter the usage counter once per hash, excluding gas and the API fee. A database recording failure is retried. Pending registrations survive service restarts. Checks back off from 15 seconds to five minutes, ending when the signed tracking token expires (seven days after preparation). No block scan or transaction broadcasting is performed by this service.

The browser helper can register immediately after wallet submission:

```ts
import { sendTrackedTransaction } from "@oblivion-protocol/sdk/wallet";
const result = await sendTrackedTransaction(wallet, prepared, review, async (submission) => {
  const response = await fetch("/your-server/register-transfer", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!response.ok) throw new Error("Registration unavailable");
  return response.json(); // Your server calls client.track(tracking, hash).
});
// Persist result.hash and result.tracking. If trackingRegistered is false,
// retry registration only; never resubmit the wallet transfer.
```

Keep the partner API key on your backend. Authenticate your relay endpoint and bind submissions to the appropriate user session. `sendReviewedTransaction` remains unchanged; integrations using it must register the returned hash themselves. Existing `client.status()` calls also enroll the hash when durable tracking is enabled, but explicit `track()` acknowledges durable acceptance. Transactions whose hash never reaches the API cannot be discovered automatically. Queue limits are 128 pending submissions per partner and 4096 globally; retry registration on transient errors.

# Oblivion Protocol SDK

TypeScript and JavaScript client for the Oblivion API on chain **4663**. Supports Abstraction, Reactive Mesh, Multi-send (fixed or random-in-range), and the ten supported RWA assets. Version 0.1.0 is distributed through npm and GitHub Releases.

## Installation

Node.js 22 or newer for your backend. Install the SDK:

```sh
npm install @oblivion-protocol/sdk
```

The package includes compiled JavaScript and TypeScript declarations. You can also download the audited tarball and checksum from [GitHub Releases](https://github.com/OblivionProtocol/oblivion-sdk/releases/tag/v0.1.0). Source checkouts require `npm ci && npm run build`.

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
  amount: '0.01', // decimal string, never a floating-point number
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

Use `api.assets()` for the asset catalog and `api.balances(sender)` for native and individual asset balances. A failed asset balance is `raw: null`, not zero. Percentages supported: 25, 50, 75, 100. Assets: NVDA, AAPL, TSLA, MSFT, AMZN, GOOGL, META, SPY, MSTR, QQQ.

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

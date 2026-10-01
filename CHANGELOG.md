# Changelog

## 0.1.4 — 2026-10-01

- Add durable confirmation registration with `client.track()`.
- Add `sendTrackedTransaction()` to report the wallet hash through a backend callback without exposing API keys.
- Return the existing hash when registration fails; never retry wallet execution automatically.


## 0.1.3 — 2026-10-01

- Discover a token contract, decimals and wallet balance.
- Prepare single-recipient ERC-20 abstraction with exact approvals.
- Preserve raw payout precision and token-address identity.
- Existing ETH, USDG and RWA request types remain available.


## 0.1.2 — 2026-09-30

- Add explicit ETH/USDG selection to Abstraction, Reactive Mesh and Multi-send. Omitted asset remains ETH.
- Add USDG asset discovery, six-decimal balances, payout types and exact-amount approval support.
- Keep USDG separate from the 11-stock/ETF RWA basket catalog. USDG multi-send supports abstraction and mesh routes.
- Validate six-decimal strings before transport and preserve backend-only credentials.
- Requires the USDG-capable API fee bundle; check `features().transferAssets` before enabling USDG.

## 0.1.1 — 2026-09-30

- Add AMD to RWA types and validation, supporting exact amounts and balance percentages.
- Align the SDK with the 11-asset API catalog while retaining the 10-asset basket limit.
- Add regression coverage for AMD, duplicate assets and basket size limits.

## 0.1.0 — 2026-09-29

- Backend client for all four transfer methods, balances, approvals, simulation, preparation and status.
- Browser wallet helper with reviewed-request, account and chain checks.
- Public registration/key lifecycle client.
- ESM, CommonJS, TypeScript declarations and no runtime dependencies.
- Safe transport errors, cancellation, timeout, redirect protection and no automatic retries.

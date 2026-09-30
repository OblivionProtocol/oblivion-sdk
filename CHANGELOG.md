# Changelog

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

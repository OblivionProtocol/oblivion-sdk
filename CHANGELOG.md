# Changelog

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

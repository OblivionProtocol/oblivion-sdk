# Security boundaries

- API credentials belong only on your server. Wallet private keys and seed phrases are never requested by this SDK.
- Registration returns a credential once. Treat it and the session as secrets; securely provision the backend and clear transient client state.
- No bundled contract sources, embedded bytecode, deployment configuration, secrets, or external runtime dependencies.
- The API prepares unsigned requests. The wallet owner reviews, signs and broadcasts. Submission is never automatically retried.
- A transport failure does not prove that registration or a wallet action failed. Reconcile state before repeating.
- Transaction input and basic API response validation are implemented. The SDK does not verify all chain state, decode execution bytecode, or prove asset privacy/unlinkability.
- Review arbitrary base URLs, injected fetch implementations, browser extensions, dependency build tooling and your own logging. They are outside the SDK's secret-handling boundary.
- Unit tests and package scanning are not an independent security audit.

Before publishing: run tests, inspect `npm pack --dry-run`, scan the actual artifact and repository history, confirm package ownership and review the license designation. Enable npm account MFA and trusted publishing where supported. Never include production environment files or credential fixtures in a repository.

If reporting a vulnerability, do not post credentials, wallet keys or exploit details publicly. Coordinate privately with the project through its official channels.

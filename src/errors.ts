/** Never contains request bodies, tokens, credentials, URLs or raw response text. */
export class OblivionError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  constructor(
    code: string,
    message: string,
    status?: number,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "OblivionError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
export function invalid(message: string): never {
  throw new OblivionError("INVALID_INPUT", message);
}

export class StoreBackendError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 501) {
    super(message);
    this.name = "StoreBackendError";
    this.code = code;
    this.status = status;
  }
}

export function isStoreBackendError(error: unknown): error is StoreBackendError {
  return error instanceof StoreBackendError;
}

import { NextResponse } from "next/server";
import { fail } from "./api-response";
import { isStoreBackendError } from "./store-backend-error";

export function storeBackendErrorResponse(error: unknown) {
  if (!isStoreBackendError(error)) {
    throw error;
  }

  return NextResponse.json(fail(error.code, error.message), { status: error.status });
}

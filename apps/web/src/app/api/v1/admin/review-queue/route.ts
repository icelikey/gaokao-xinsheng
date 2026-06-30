import { NextResponse } from "next/server";
import { ok } from "@/lib/api-response";
import { listReviewQueue } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

export async function GET() {
  const items = await listReviewQueue().catch(storeBackendErrorResponse);

  if (items instanceof NextResponse) {
    return items;
  }

  return NextResponse.json(ok(items));
}

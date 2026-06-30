import { NextResponse } from "next/server";
import { ReviewActionSchema } from "@gaokao-xinsheng/contracts";
import { fail, ok } from "@/lib/api-response";
import { updateReviewQueueItem } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type ReviewActionRouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function PATCH(request: Request, context: ReviewActionRouteContext) {
  const { reportId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = ReviewActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(fail("REQUEST_INVALID", "复核动作参数无效"), { status: 400 });
  }

  const result = await updateReviewQueueItem({
    reportId,
    action: parsed.data.action,
    actor: parsed.data.actor,
    note: parsed.data.note
  }).catch(storeBackendErrorResponse);

  if (result instanceof NextResponse) {
    return result;
  }

  if (!result) {
    return NextResponse.json(fail("REVIEW_ITEM_NOT_FOUND", "复核任务不存在或无需复核"), { status: 404 });
  }

  return NextResponse.json(ok(result));
}

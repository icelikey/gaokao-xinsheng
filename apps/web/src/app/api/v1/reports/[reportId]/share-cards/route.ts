import { NextResponse } from "next/server";
import { CreateShareCardSchema } from "@gaokao-xinsheng/contracts";
import { fail, ok } from "@/lib/api-response";
import { createShareCard } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type ShareCardsRouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function POST(request: Request, context: ShareCardsRouteContext) {
  const { reportId } = await context.params;
  const idempotencyKey = request.headers.get("Idempotency-Key");

  if (!idempotencyKey) {
    return NextResponse.json(fail("REQUEST_INVALID", "分享卡幂等键无效"), { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = CreateShareCardSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json(fail("REQUEST_INVALID", "分享公开字段设置无效"), { status: 400 });
  }

  const shareCard = await createShareCard({
    reportId,
    idempotencyKey,
    visibility: parsed.data.visibility
  }).catch(storeBackendErrorResponse);

  if (shareCard instanceof NextResponse) {
    return shareCard;
  }

  if (!shareCard) {
    return NextResponse.json(fail("REPORT_NOT_FOUND", "报告不存在"), { status: 404 });
  }

  return NextResponse.json(ok(shareCard), { status: 201 });
}

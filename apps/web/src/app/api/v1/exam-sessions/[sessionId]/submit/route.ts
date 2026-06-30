import { NextResponse } from "next/server";
import { SubmitExamSchema } from "@gaokao-xinsheng/contracts";
import { fail, ok } from "@/lib/api-response";
import { submitExamSession } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type SubmitRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: Request, context: SubmitRouteContext) {
  const { sessionId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = SubmitExamSchema.safeParse(body);
  const idempotencyKey = request.headers.get("Idempotency-Key");

  if (!parsed.success || !idempotencyKey) {
    return NextResponse.json(fail("REQUEST_INVALID", "交卷参数或幂等键无效"), { status: 400 });
  }

  const report = await submitExamSession({
    sessionId,
    idempotencyKey
  }).catch(storeBackendErrorResponse);

  if (report instanceof NextResponse) {
    return report;
  }

  if (!report) {
    return NextResponse.json(fail("EXAM_SESSION_NOT_FOUND", "考试会话不存在"), { status: 404 });
  }

  return NextResponse.json(ok(report), { status: 202 });
}

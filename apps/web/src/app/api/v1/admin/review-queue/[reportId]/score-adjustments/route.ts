import { NextResponse } from "next/server";
import { ReviewScoreAdjustmentSchema } from "@gaokao-xinsheng/contracts";
import { fail, ok } from "@/lib/api-response";
import { adjustReportQuestionScore } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type ScoreAdjustmentRouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function POST(request: Request, context: ScoreAdjustmentRouteContext) {
  const { reportId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = ReviewScoreAdjustmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(fail("REQUEST_INVALID", "人工调分参数无效"), { status: 400 });
  }

  const result = await adjustReportQuestionScore({
    reportId,
    questionId: parsed.data.questionId,
    score: parsed.data.score,
    actor: parsed.data.actor,
    reason: parsed.data.reason
  }).catch(storeBackendErrorResponse);

  if (result instanceof NextResponse) {
    return result;
  }

  if (!result) {
    return NextResponse.json(fail("SCORE_ADJUSTMENT_NOT_ALLOWED", "报告或题目不存在，或分数超出题目范围"), { status: 404 });
  }

  return NextResponse.json(ok(result));
}

import { NextResponse } from "next/server";
import { SaveAnswerSchema } from "@gaokao-xinsheng/contracts";
import { fail, ok } from "@/lib/api-response";
import { saveAnswer } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type SaveAnswerRouteContext = {
  params: Promise<{
    sessionId: string;
    questionId: string;
  }>;
};

export async function PUT(request: Request, context: SaveAnswerRouteContext) {
  const { sessionId, questionId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = SaveAnswerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(fail("REQUEST_INVALID", "保存答案参数无效"), { status: 400 });
  }

  const saved = await saveAnswer({
    sessionId,
    questionId,
    answer: parsed.data.answer,
    clientVersion: parsed.data.client_version
  }).catch(storeBackendErrorResponse);

  if (saved instanceof NextResponse) {
    return saved;
  }

  if (!saved) {
    return NextResponse.json(fail("EXAM_STATE_INVALID", "当前考试不能保存答案"), { status: 409 });
  }

  return NextResponse.json(ok(saved));
}

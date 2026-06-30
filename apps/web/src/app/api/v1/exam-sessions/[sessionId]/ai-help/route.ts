import { NextResponse } from "next/server";
import { AiHelpRequestSchema } from "@gaokao-xinsheng/contracts";
import { fail, ok } from "@/lib/api-response";
import { requestAiHelp } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type AiHelpRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: Request, context: AiHelpRouteContext) {
  const { sessionId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = AiHelpRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(fail("REQUEST_INVALID", "AI辅导参数无效"), { status: 400 });
  }

  const result = await requestAiHelp({
    sessionId,
    questionId: parsed.data.question_id,
    level: parsed.data.level
  }).catch(storeBackendErrorResponse);

  if (result instanceof NextResponse) {
    return result;
  }

  if (!result) {
    return NextResponse.json(fail("AI_HELP_FAILED", "无法创建AI辅导事件"), { status: 404 });
  }

  return NextResponse.json(ok(result));
}

import { NextResponse } from "next/server";
import { CreateExamSessionSchema } from "@gaokao-xinsheng/contracts";
import { fail, ok } from "@/lib/api-response";
import { createExamSession } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateExamSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(fail("REQUEST_INVALID", "创建考试会话参数无效"), { status: 400 });
  }

  const session = await createExamSession({
    paperId: parsed.data.paper_id,
    mode: parsed.data.mode,
    settings: parsed.data.settings
  }).catch(storeBackendErrorResponse);

  if (session instanceof NextResponse) {
    return session;
  }

  if (!session) {
    return NextResponse.json(fail("PAPER_NOT_FOUND", "试卷不存在"), { status: 404 });
  }

  return NextResponse.json(ok(session), { status: 201 });
}

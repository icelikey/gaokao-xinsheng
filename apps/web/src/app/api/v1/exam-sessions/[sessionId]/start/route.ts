import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { startExamSession } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type StartRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(_request: Request, context: StartRouteContext) {
  const { sessionId } = await context.params;
  const session = await startExamSession(sessionId).catch(storeBackendErrorResponse);

  if (session instanceof NextResponse) {
    return session;
  }

  if (!session) {
    return NextResponse.json(fail("EXAM_SESSION_NOT_FOUND", "考试会话不存在"), { status: 404 });
  }

  return NextResponse.json(ok(session));
}

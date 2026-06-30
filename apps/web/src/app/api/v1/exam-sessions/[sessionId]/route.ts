import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { getExamSession } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type SessionRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(_request: Request, context: SessionRouteContext) {
  const { sessionId } = await context.params;
  const session = await getExamSession(sessionId).catch(storeBackendErrorResponse);

  if (session instanceof NextResponse) {
    return session;
  }

  if (!session) {
    return NextResponse.json(fail("EXAM_SESSION_NOT_FOUND", "考试会话不存在"), { status: 404 });
  }

  return NextResponse.json(ok(session));
}

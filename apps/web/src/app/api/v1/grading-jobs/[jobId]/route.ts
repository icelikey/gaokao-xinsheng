import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { getGradingJob } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type GradingJobRouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_request: Request, context: GradingJobRouteContext) {
  const { jobId } = await context.params;
  const job = await getGradingJob(jobId).catch(storeBackendErrorResponse);

  if (job instanceof NextResponse) {
    return job;
  }

  if (!job) {
    return NextResponse.json(fail("GRADING_JOB_NOT_FOUND", "批改任务不存在"), { status: 404 });
  }

  return NextResponse.json(ok(job));
}

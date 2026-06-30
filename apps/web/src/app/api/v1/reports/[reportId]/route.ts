import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { getExamReport } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type ReportRouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function GET(_request: Request, context: ReportRouteContext) {
  const { reportId } = await context.params;
  const report = await getExamReport(reportId).catch(storeBackendErrorResponse);

  if (report instanceof NextResponse) {
    return report;
  }

  if (!report) {
    return NextResponse.json(fail("REPORT_NOT_FOUND", "报告不存在"), { status: 404 });
  }

  return NextResponse.json(ok(report));
}

import { NextResponse } from "next/server";
import { getPublicMvpPaper } from "@gaokao-xinsheng/contracts";
import { fail, ok } from "@/lib/api-response";

type PublicPaperRouteContext = {
  params: Promise<{
    paperId: string;
  }>;
};

export async function GET(_request: Request, context: PublicPaperRouteContext) {
  const { paperId } = await context.params;
  const paper = getPublicMvpPaper(paperId);

  if (!paper) {
    return NextResponse.json(fail("PAPER_NOT_FOUND", "试卷不存在"), { status: 404 });
  }

  return NextResponse.json(ok(paper));
}

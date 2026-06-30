import { NextResponse } from "next/server";
import { getMvpPaper } from "@gaokao-xinsheng/contracts";

type PaperRouteContext = {
  params: Promise<{
    paperId: string;
  }>;
};

export async function GET(_request: Request, context: PaperRouteContext) {
  const { paperId } = await context.params;
  const paper = getMvpPaper(paperId);

  if (!paper) {
    return NextResponse.json(
      {
        request_id: crypto.randomUUID(),
        data: null,
        error: {
          code: "PAPER_NOT_FOUND",
          message: "试卷不存在"
        }
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    request_id: crypto.randomUUID(),
    data: paper,
    error: null
  });
}

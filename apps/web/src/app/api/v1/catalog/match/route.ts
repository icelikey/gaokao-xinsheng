import { NextRequest, NextResponse } from "next/server";
import { PaperMatchRequestSchema, matchPapers } from "@gaokao-xinsheng/contracts";

export async function POST(request: NextRequest) {
  const parsed = PaperMatchRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        request_id: crypto.randomUUID(),
        data: null,
        error: {
          code: "REQUEST_INVALID",
          message: "试卷匹配参数无效。"
        }
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    request_id: crypto.randomUUID(),
    data: matchPapers(parsed.data),
    error: null
  });
}

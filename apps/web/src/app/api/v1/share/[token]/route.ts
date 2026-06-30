import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { getShareCardByToken } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

type ShareRouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(_request: Request, context: ShareRouteContext) {
  const { token } = await context.params;
  const shareCard = await getShareCardByToken(token).catch(storeBackendErrorResponse);

  if (shareCard instanceof NextResponse) {
    return shareCard;
  }

  if (!shareCard) {
    return NextResponse.json(fail("SHARE_CARD_NOT_FOUND", "分享卡不存在或已失效"), { status: 404 });
  }

  return NextResponse.json(ok(shareCard));
}

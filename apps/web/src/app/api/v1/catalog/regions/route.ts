import { NextRequest, NextResponse } from "next/server";
import { getCatalogRegions } from "@gaokao-xinsheng/contracts";

export function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;

  if (yearParam && !Number.isInteger(year)) {
    return NextResponse.json(
      {
        request_id: crypto.randomUUID(),
        data: null,
        error: {
          code: "REQUEST_INVALID",
          message: "year must be an integer."
        }
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    request_id: crypto.randomUUID(),
    data: getCatalogRegions({ year }),
    error: null
  });
}

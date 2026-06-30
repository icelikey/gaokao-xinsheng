import { NextResponse } from "next/server";
import { getCatalogYears } from "@gaokao-xinsheng/contracts";

export function GET() {
  return NextResponse.json({
    request_id: crypto.randomUUID(),
    data: getCatalogYears(),
    error: null
  });
}

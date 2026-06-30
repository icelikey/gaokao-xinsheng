import { NextResponse } from "next/server";
import { PaperImportRequestSchema } from "@gaokao-xinsheng/contracts";
import { fail, ok } from "@/lib/api-response";
import { createPaperImport } from "@/lib/exam-store-backend";
import { storeBackendErrorResponse } from "@/lib/store-error-response";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = PaperImportRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(fail("REQUEST_INVALID", "Paper import payload is invalid."), { status: 400 });
  }

  const batch = await createPaperImport({
    paper: parsed.data.paper,
    dryRun: parsed.data.dryRun ?? true,
    conflictPolicy: parsed.data.conflictPolicy,
    actor: parsed.data.actor
  }).catch(storeBackendErrorResponse);

  if (batch instanceof NextResponse) {
    return batch;
  }

  return NextResponse.json(ok(batch), { status: 201 });
}

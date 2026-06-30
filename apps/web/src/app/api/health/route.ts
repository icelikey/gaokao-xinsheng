import { NextResponse } from "next/server";
import { getRuntimeReadiness } from "@/lib/runtime-config";

export function GET() {
  const runtime = getRuntimeReadiness();

  return NextResponse.json({
    service: "gaokao-xinsheng-web",
    status: runtime.ready ? "ok" : "configuration_incomplete",
    environment: runtime.appEnv,
    storage: runtime.examStoreBackend,
    missing: runtime.missing
  });
}

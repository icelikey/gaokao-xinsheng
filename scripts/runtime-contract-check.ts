import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

const envExample = read(".env.example");
const runtimeConfig = read("apps/web/src/lib/runtime-config.ts");
const healthRoute = read("apps/web/src/app/api/health/route.ts");
const supabaseAdapter = read("apps/web/src/lib/supabase-exam-store.ts");
const supabaseServer = read("apps/web/src/lib/supabase-server.ts");
const miniprogramEnv = read("apps/miniprogram/env.js");
const miniprogramApi = read("apps/miniprogram/utils/api.js");
const apiRouteFiles = listFiles(path.join(repoRoot, "apps", "web", "src", "app", "api")).filter((file) =>
  file.endsWith(".ts")
);
const apiRouteSource = apiRouteFiles.map((file) => readFileSync(file, "utf8")).join("\n");

assert(envExample.includes("NEXT_PUBLIC_APP_ENV="), ".env.example must include public app environment.");
assert(!envExample.includes("NEXT_PUBLIC_SUPABASE_URL"), "Do not expose Supabase URL through NEXT_PUBLIC by default.");
assert(!envExample.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"), "Do not expose Supabase anon key through NEXT_PUBLIC by default.");
assert(envExample.includes("APP_BASE_URL="), ".env.example must include server app base URL.");
assert(envExample.includes("EXAM_STORE_BACKEND=memory"), ".env.example must default to memory storage.");
assert(envExample.includes("SUPABASE_STORE_ADAPTER_ENABLED=false"), ".env.example must keep Supabase adapter disabled by default.");
assert(envExample.includes("SUPABASE_URL="), ".env.example must include server-only Supabase URL.");
assert(envExample.includes("SUPABASE_SERVICE_ROLE_KEY="), ".env.example must include service role key placeholder.");

assert(runtimeConfig.includes('ExamStoreBackend = "memory" | "supabase"'), "Runtime config must define storage backend enum.");
assert(runtimeConfig.includes("SUPABASE_SERVICE_ROLE_KEY"), "Runtime config must validate service-role readiness.");
assert(runtimeConfig.includes("SUPABASE_STORE_ADAPTER_ENABLED"), "Runtime config must require explicit Supabase adapter enablement.");
assert(runtimeConfig.includes("getRuntimeReadiness"), "Runtime config must expose readiness without secrets.");
assert(supabaseServer.includes("SUPABASE_SERVICE_ROLE_KEY"), "Supabase server client must use service role only on the server.");
assert(supabaseServer.includes("/rest/v1/"), "Supabase server client must target PostgREST.");
assert(supabaseAdapter.includes("enqueue_grading_job"), "Supabase adapter must enqueue grading jobs through RPC.");
assert(supabaseAdapter.includes("grading_results"), "Supabase adapter must persist grading results.");
assert(supabaseAdapter.includes("exam_reports"), "Supabase adapter must persist exam reports.");
assert(supabaseAdapter.includes("idempotency_key"), "Supabase adapter must preserve idempotency keys.");
assert(healthRoute.includes("getRuntimeReadiness"), "Health route must use runtime readiness.");
assert(!healthRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Health route must not read or expose secrets directly.");
assert(!healthRoute.includes("AI_PROVIDER_API_KEY"), "Health route must not read or expose AI keys directly.");
assert(!healthRoute.includes("WECHAT_APP_SECRET"), "Health route must not read or expose WeChat secrets directly.");

const miniprogramSource = `${miniprogramEnv}\n${miniprogramApi}`;
const forbiddenClientPatterns = [
  /SUPABASE_URL/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /NEXT_PUBLIC_SUPABASE/i,
  /AI_PROVIDER_API_KEY/i,
  /WECHAT_APP_SECRET/i,
  /AppSecret/i,
  /service_role/i
];

for (const pattern of forbiddenClientPatterns) {
  assert(!pattern.test(miniprogramSource), `Miniprogram source must not include ${pattern}.`);
}

assert(apiRouteSource.includes("@/lib/exam-store-backend"), "API routes must go through the store backend facade.");
assert(!apiRouteSource.includes("@/lib/exam-store\""), "API routes must not import memory exam-store directly.");
assert(apiRouteSource.includes("storeBackendErrorResponse"), "API routes must handle pending Supabase backend errors.");

console.log(
  JSON.stringify(
    {
      ok: true,
      envDefaults: {
        publicSupabase: false,
        storeBackend: "memory",
        supabaseAdapterEnabled: false,
        serverSupabaseUrl: true
      },
      healthExposesSecrets: false,
      supabaseAdapterPresent: true,
      apiRoutesUseBackendFacade: true,
      miniprogramSecretPatterns: 0
    },
    null,
    2
  )
);

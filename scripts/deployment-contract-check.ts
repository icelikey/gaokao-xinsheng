import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(read(relativePath)) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const packageJson = readJson<{
  packageManager?: string;
  scripts?: Record<string, string>;
}>("package.json");
const webPackageJson = readJson<{
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
}>("apps/web/package.json");
const vercelConfig = readJson<{
  $schema?: string;
  framework?: string;
  buildCommand?: string;
  devCommand?: string;
  env?: Record<string, string>;
}>("apps/web/vercel.json");
const ciWorkflow = read(".github/workflows/ci.yml");
const pnpmWorkspace = read("pnpm-workspace.yaml");
const gitignore = read(".gitignore");
const supabaseConfig = read("supabase/config.toml");
const gradingWorker = read("supabase/functions/grading-worker/index.ts");
const gradingWorkerDenoConfig = readJson<{
  compilerOptions?: {
    lib?: string[];
    strict?: boolean;
  };
}>("supabase/functions/grading-worker/deno.json");

assert(packageJson.packageManager === "pnpm@9.15.4", "Root packageManager must pin pnpm for Vercel/GitHub parity.");
assert(packageJson.scripts?.verify?.includes("test:deployment-contract"), "Default verify must include deployment contract checks.");
assert(pnpmWorkspace.includes("apps/*"), "pnpm workspace must include apps/*.");
assert(pnpmWorkspace.includes("packages/*"), "pnpm workspace must include packages/*.");

assert(webPackageJson.name === "@gaokao-xinsheng/web", "Vercel web project must point at the Next.js workspace package.");
assert(webPackageJson.scripts?.build === "next build", "Web package build script must run Next build.");
assert(webPackageJson.dependencies?.next, "Web package must declare Next.js dependency for Vercel detection.");
assert(vercelConfig.$schema === "https://openapi.vercel.sh/vercel.json", "Web Vercel config must use the official schema URL.");
assert(vercelConfig.framework === "nextjs", "Web Vercel config must force the Next.js framework preset.");
assert(vercelConfig.buildCommand === "pnpm build", "Web Vercel build command must be local to apps/web.");
assert(vercelConfig.devCommand === "pnpm dev", "Web Vercel dev command must be local to apps/web.");
assert(!vercelConfig.env, "Do not hard-code environment variables in vercel.json.");
assert(gitignore.includes(".vercel/"), "Local Vercel metadata must stay ignored.");

assert(ciWorkflow.includes("pnpm/action-setup@v4"), "CI must install pnpm through the official action.");
assert(ciWorkflow.includes("actions/setup-node@v4"), "CI must configure Node through setup-node.");
assert(ciWorkflow.includes("node-version: 22"), "CI must match the Node 22 runtime used by local verification.");
assert(ciWorkflow.includes("pnpm install --frozen-lockfile"), "CI must install with the frozen lockfile.");
assert(ciWorkflow.includes("pnpm verify"), "CI must run pnpm verify.");

assert(supabaseConfig.includes("[edge_runtime]"), "Supabase config must enable the edge runtime section.");
assert(existsSync(path.join(repoRoot, "supabase", "functions", "grading-worker", "index.ts")), "Missing grading-worker function.");
assert(gradingWorker.includes("Deno.serve"), "Grading worker must expose a Deno.serve handler.");
assert(gradingWorker.includes("job_id") && gradingWorker.includes("session_id"), "Grading worker must validate job and session ids.");
assert(!/SUPABASE_SERVICE_ROLE_KEY|AI_PROVIDER_API_KEY|WECHAT_APP_SECRET/.test(gradingWorker), "Grading worker must not hard-code secret env names yet.");
assert(gradingWorkerDenoConfig.compilerOptions?.strict === true, "Grading worker Deno config must use strict mode.");
assert(gradingWorkerDenoConfig.compilerOptions?.lib?.includes("deno.ns"), "Grading worker Deno config must include deno.ns.");

console.log(
  JSON.stringify(
    {
      ok: true,
      ciRunsVerify: true,
      vercelProjectRoot: "apps/web",
      vercelFramework: vercelConfig.framework,
      vercelBuildCommand: vercelConfig.buildCommand,
      vercelEnvInRepo: false,
      supabaseEdgeRuntime: true,
      gradingWorkerStub: true
    },
    null,
    2
  )
);

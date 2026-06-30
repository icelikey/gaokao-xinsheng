export type AppEnvironment = "development" | "preview" | "staging" | "production";
export type ExamStoreBackend = "memory" | "supabase";

export type RuntimeConfig = {
  appEnv: AppEnvironment;
  appBaseUrl: string;
  examStoreBackend: ExamStoreBackend;
  supabaseUrl: string | null;
  hasSupabaseServiceRoleKey: boolean;
  hasSupabaseStoreAdapterEnabled: boolean;
  hasAiProviderApiKey: boolean;
  hasWechatAppSecret: boolean;
};

const appEnvironments = new Set<AppEnvironment>(["development", "preview", "staging", "production"]);
const examStoreBackends = new Set<ExamStoreBackend>(["memory", "supabase"]);

function readAppEnv(value: string | undefined): AppEnvironment {
  return appEnvironments.has(value as AppEnvironment) ? (value as AppEnvironment) : "development";
}

function readExamStoreBackend(value: string | undefined): ExamStoreBackend {
  return examStoreBackends.has(value as ExamStoreBackend) ? (value as ExamStoreBackend) : "memory";
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    appEnv: readAppEnv(process.env.NEXT_PUBLIC_APP_ENV),
    appBaseUrl: process.env.APP_BASE_URL ?? "http://127.0.0.1:3000",
    examStoreBackend: readExamStoreBackend(process.env.EXAM_STORE_BACKEND),
    supabaseUrl: process.env.SUPABASE_URL ?? null,
    hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasSupabaseStoreAdapterEnabled: process.env.SUPABASE_STORE_ADAPTER_ENABLED === "true",
    hasAiProviderApiKey: Boolean(process.env.AI_PROVIDER_API_KEY),
    hasWechatAppSecret: Boolean(process.env.WECHAT_APP_SECRET)
  };
}

export function getRuntimeReadiness() {
  const config = getRuntimeConfig();
  const missing: string[] = [];

  if (config.examStoreBackend === "supabase") {
    if (!config.supabaseUrl) {
      missing.push("SUPABASE_URL");
    }

    if (!config.hasSupabaseServiceRoleKey) {
      missing.push("SUPABASE_SERVICE_ROLE_KEY");
    }

    if (!config.hasSupabaseStoreAdapterEnabled) {
      missing.push("SUPABASE_STORE_ADAPTER_ENABLED");
    }
  }

  return {
    appEnv: config.appEnv,
    examStoreBackend: config.examStoreBackend,
    ready: missing.length === 0,
    missing
  };
}

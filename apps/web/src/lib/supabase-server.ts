import { StoreBackendError } from "./store-backend-error";

type SupabaseRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  prefer?: string;
};

type SupabaseStorageUploadOptions = {
  bucket: string;
  objectPath: string;
  body: Uint8Array;
  contentType: string;
  upsert?: boolean;
};

function getServerSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new StoreBackendError(
      "SUPABASE_SERVER_CONFIG_MISSING",
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the Supabase store adapter.",
      500
    );
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey
  };
}

export async function supabaseRest<T>(path: string, options: SupabaseRequestOptions = {}): Promise<T> {
  const config = getServerSupabaseConfig();
  const url = new URL(`${config.url}/rest/v1/${path.replace(/^\//, "")}`);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
      ...(options.prefer ? { prefer: options.prefer } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new StoreBackendError(
      "SUPABASE_REQUEST_FAILED",
      `Supabase request failed: ${response.status} ${text.slice(0, 500)}`,
      response.status
    );
  }

  if (!text) {
    return null as T;
  }

  return JSON.parse(text) as T;
}

export async function supabaseRpc<T>(functionName: string, body: unknown): Promise<T> {
  return supabaseRest<T>(`rpc/${functionName}`, {
    method: "POST",
    body
  });
}

export async function supabaseStorageUpload(options: SupabaseStorageUploadOptions) {
  const config = getServerSupabaseConfig();
  const encodedPath = options.objectPath.split("/").map(encodeURIComponent).join("/");
  const url = `${config.url}/storage/v1/object/${encodeURIComponent(options.bucket)}/${encodedPath}`;
  const body = new ArrayBuffer(options.body.byteLength);
  new Uint8Array(body).set(options.body);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": options.contentType,
      ...(options.upsert ? { "x-upsert": "true" } : {})
    },
    body
  });
  const text = await response.text();

  if (!response.ok) {
    throw new StoreBackendError(
      "SUPABASE_STORAGE_UPLOAD_FAILED",
      `Supabase storage upload failed: ${response.status} ${text.slice(0, 500)}`,
      response.status
    );
  }
}

export function supabasePublicStorageUrl(bucket: string, objectPath: string) {
  const config = getServerSupabaseConfig();
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${config.url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
}

export function ok<T>(data: T) {
  return {
    request_id: crypto.randomUUID(),
    data,
    error: null
  };
}

export function fail(code: string, message: string) {
  return {
    request_id: crypto.randomUUID(),
    data: null,
    error: {
      code,
      message
    }
  };
}

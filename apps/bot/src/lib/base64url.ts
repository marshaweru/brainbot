export function b64urlToJson<T = unknown>(input: string): T {
  const data = Buffer.from(input, "base64url").toString("utf8");
  return JSON.parse(data) as T;
}

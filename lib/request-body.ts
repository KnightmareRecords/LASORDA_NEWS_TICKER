/** Treat malformed JSON and non-object bodies as empty input, then let field validators respond. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json().catch(() => null);
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

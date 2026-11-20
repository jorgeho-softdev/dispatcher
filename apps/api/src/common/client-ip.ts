/**
 * Resolves the client IP used to rate-limit credential endpoints.
 *
 * Behind Railway, `req.ip` (trust proxy) can be one of several internal edge
 * hops, which splits one user's attempts across counters. Railway puts the
 * real client IP in `X-Real-IP` and overwrites any value the client sends,
 * so in production CLIENT_IP_HEADER=x-real-ip. The web BFF calls the api over
 * the private network (no edge) and sets the same header with the browser's
 * IP. Without the setting (local, tests) the socket/proxy IP is used.
 */
export function resolveClientIp(
  req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  header?: string,
): string {
  if (header) {
    const raw = req.headers?.[header.toLowerCase()];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0]?.trim();
    if (value) return value;
  }
  return req.ip ?? 'unknown';
}

export function isLocal(request: Request): boolean {
  const host = request.headers.get('host') || '';
  return /^(localhost|127\.0\.0\.1|10\.|192\.168\.|.*\.localhost)(:\d+)?$/.test(host);
}

import { resolveClientIp } from './client-ip';

describe('resolveClientIp', () => {
  const req = (
    headers: Record<string, string | string[]>,
    ip = '10.0.0.5',
  ) => ({ ip, headers });

  it('uses the configured header when present (Railway: x-real-ip)', () => {
    expect(
      resolveClientIp(req({ 'x-real-ip': '203.0.113.7' }), 'x-real-ip'),
    ).toBe('203.0.113.7');
  });

  it('is case-insensitive on the header name and trims lists', () => {
    expect(
      resolveClientIp(
        req({ 'x-real-ip': ' 203.0.113.7, 10.0.0.1' }),
        'X-Real-IP',
      ),
    ).toBe('203.0.113.7');
    expect(
      resolveClientIp(req({ 'x-real-ip': ['198.51.100.1'] }), 'x-real-ip'),
    ).toBe('198.51.100.1');
  });

  it('falls back to req.ip when the header is missing or empty', () => {
    expect(resolveClientIp(req({}), 'x-real-ip')).toBe('10.0.0.5');
    expect(resolveClientIp(req({ 'x-real-ip': '  ' }), 'x-real-ip')).toBe(
      '10.0.0.5',
    );
  });

  it('ignores client headers when no header is configured (local, tests)', () => {
    expect(resolveClientIp(req({ 'x-real-ip': '203.0.113.7' }))).toBe(
      '10.0.0.5',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './api-base-url';

describe('resolveApiBaseUrl', () => {
  it('uses the address from VITE_API_URL', () => {
    expect(resolveApiBaseUrl({ VITE_API_URL: 'https://api.example.com', DEV: false })).toBe(
      'https://api.example.com',
    );
  });

  it.each([
    ['one trailing slash', 'https://api.example.com/', 'https://api.example.com'],
    ['several trailing slashes', 'https://api.example.com///', 'https://api.example.com'],
    ['spaces around it', '  https://api.example.com  ', 'https://api.example.com'],
    ['a path prefix', 'https://example.com/api/', 'https://example.com/api'],
    ['a port', 'http://192.168.1.20:3000', 'http://192.168.1.20:3000'],
  ])('accepts %s', (_label, value, expected) => {
    expect(resolveApiBaseUrl({ VITE_API_URL: value, DEV: false })).toBe(expected);
  });

  it('points at the local API while developing when nothing is configured', () => {
    expect(resolveApiBaseUrl({ DEV: true })).toBe('http://localhost:3000');
  });

  it('treats an empty VITE_API_URL as not configured', () => {
    expect(resolveApiBaseUrl({ VITE_API_URL: '', DEV: true })).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl({ VITE_API_URL: '   ', DEV: false })).toBe('');
  });

  it('uses the same origin in production when nothing is configured', () => {
    expect(resolveApiBaseUrl({ DEV: false })).toBe('');
  });

  it('prefers the configured address over the development default', () => {
    expect(resolveApiBaseUrl({ VITE_API_URL: 'http://localhost:4000', DEV: true })).toBe(
      'http://localhost:4000',
    );
  });

  it.each([
    ['a host without scheme', 'api.example.com'],
    ['a scheme that is not http or https', 'ftp://api.example.com'],
    ['a script', 'javascript:alert(1)'],
    ['credentials in the address', 'https://user:secret@api.example.com'],
    ['a query string', 'https://api.example.com?x=1'],
    ['a fragment', 'https://api.example.com#top'],
    ['plain text', 'not an address'],
  ])('rejects %s and names the variable', (_label, value) => {
    expect(() => resolveApiBaseUrl({ VITE_API_URL: value, DEV: false })).toThrow(/VITE_API_URL/);
  });

  it('does not repeat a rejected value that carries credentials', () => {
    expect(() =>
      resolveApiBaseUrl({ VITE_API_URL: 'https://user:secret@api.example.com', DEV: false }),
    ).toThrow(/^((?!secret).)*$/s);
  });
});

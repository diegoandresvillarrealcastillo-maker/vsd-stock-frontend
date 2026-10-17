/** Por que el servicio de identidad no dejo entrar, registrar o renovar. La interfaz decide la frase (presentation/). */
export type AuthFailureKind =
  | 'invalid-credentials'
  | 'email-taken'
  | 'weak-password'
  | 'invalid-email'
  | 'email-not-confirmed'
  | 'signup-disabled'
  | 'rate-limited'
  | 'unavailable'
  | 'network'
  | 'unknown';

export class AuthError extends Error {
  constructor(readonly kind: AuthFailureKind) {
    // Nunca lo que la persona escribio: una contrasena no va en un mensaje de error.
    super(`Authentication failed: ${kind}`);
    this.name = 'AuthError';
  }
}

/** Los codigos de error de Supabase Auth que la interfaz sabe explicar. */
const KNOWN: Readonly<Record<string, AuthFailureKind>> = {
  invalid_credentials: 'invalid-credentials',
  user_already_exists: 'email-taken',
  email_exists: 'email-taken',
  weak_password: 'weak-password',
  email_address_invalid: 'invalid-email',
  email_not_confirmed: 'email-not-confirmed',
  signup_disabled: 'signup-disabled',
  over_request_rate_limit: 'rate-limited',
  over_email_send_rate_limit: 'rate-limited',
};

function codeOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const code = (body as { error_code?: unknown }).error_code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Lee la respuesta de error del servicio de identidad. `status` es `null` si no hubo respuesta. Un 5xx es del servicio
 * aunque diga otra cosa, un 429 es limite de uso, y un codigo que no se conoce es `unknown`: no se adivina.
 */
export function authFailureOf(status: number | null, body: unknown): AuthFailureKind {
  if (status === null) return 'network';
  if (status >= 500) return 'unavailable';
  if (status === 429) return 'rate-limited';
  const code = codeOf(body);
  // hasOwn y no `in`: «toString» no es un codigo de error.
  if (code !== undefined && Object.hasOwn(KNOWN, code)) return KNOWN[code] ?? 'unknown';
  return 'unknown';
}

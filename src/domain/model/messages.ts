import { ApiError, type ApiFailure } from './api-error';
import { AuthError, type AuthFailureKind } from './auth-failure';

/** Lo que se le dice a la persona cuando entrar o registrarse falla. Nunca lo que escribio: ni correo ni contrasena. */
const AUTH_MESSAGES: Readonly<Record<AuthFailureKind, string>> = {
  'invalid-credentials': 'El correo o la contraseña no coinciden.',
  'email-taken': 'Ese correo ya tiene una cuenta. Ingresa en vez de crear otra.',
  'weak-password':
    'Esa contraseña es muy débil. Usa al menos 6 caracteres y que no sea una de las comunes.',
  'invalid-email': 'Ese correo no parece válido. Revisa que esté bien escrito.',
  'email-not-confirmed':
    'Confirma tu correo antes de entrar: te enviamos un enlace al registrarte.',
  'signup-disabled':
    'Por ahora no se pueden crear cuentas nuevas. Pídele una invitación a quien administra el negocio.',
  'rate-limited': 'Hubo demasiados intentos. Espera un momento antes de volver a probar.',
  unavailable: 'El servicio de acceso no está disponible ahora. Inténtalo en unos minutos.',
  network: 'No hay conexión con el servicio de acceso. Revisa tu internet e inténtalo de nuevo.',
  unknown:
    'No pudimos completar esto. Inténtalo de nuevo; si sigue igual, avisa a quien administra el sistema.',
};

export function authMessage(kind: AuthFailureKind): string {
  return AUTH_MESSAGES[kind];
}

/** Lo que dice cada codigo estable de la API (ADR 0019). El texto del servidor es para quien programa y no se muestra. */
const PROBLEM_MESSAGES: Readonly<Record<string, string>> = {
  'validation-failed': 'Revisa los datos marcados.',
  forbidden: 'Tu rol no permite hacer esto.',
  'user-inactive': 'Tu acceso fue dado de baja. Habla con quien administra el negocio.',
  'already-member': 'Esa persona ya trabaja en un negocio.',
  'no-membership': 'Primero crea un negocio o canjea una invitación.',
  'person-not-found': 'Esa persona ya no está en el negocio.',
  'last-owner':
    'El negocio no puede quedarse sin un dueño activo. Nombra a otra persona como dueño primero.',
  'invitation-not-found': 'Ese código no existe o ya se usó. Revísalo o pide uno nuevo.',
  'invitation-expired': 'Ese código venció. Pídele uno nuevo a quien te invitó.',
  'invitation-not-pending': 'Esa persona ya canjeó su invitación: no hay código que renovar.',
  'category-not-found': 'Esa categoría ya no existe.',
  'product-not-found': 'Ese producto ya no existe en tu negocio.',
  'category-name-taken': 'Ya hay una categoría con ese nombre.',
  'category-in-use':
    'La categoría todavía tiene productos. Muévelos a otra categoría o archívalos antes de borrarla.',
  'sku-taken': 'Ese SKU ya lo tiene otro producto.',
  'barcode-taken': 'Ese código de barras ya lo tiene otro producto.',
  'unit-locked':
    'La unidad no se puede cambiar porque el producto ya tiene movimientos de existencias.',
  'supplier-not-found': 'Ese proveedor ya no existe en tu negocio.',
  'purchase-not-found': 'Esa compra no existe en tu negocio.',
  'supplier-in-use':
    'Ese proveedor ya tiene compras y no se puede borrar. Cámbiale el nombre si hace falta.',
  'operation-id-reused':
    'Esta compra ya se había registrado con otros datos. Mira la lista de compras antes de repetirla.',
};

const GENERIC =
  'No pudimos completar esto. Inténtalo de nuevo; si sigue igual, avisa a quien administra el sistema.';

function waitText(milliseconds: number): string {
  const seconds = Math.max(1, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

/**
 * Lo que se le dice a la persona cuando la API no pudo hacer lo que pidio. Se decide por la clase del fallo (ADR 0009)
 * y por el `code` del problema; un codigo que no se conoce no se muestra, se dice algo general.
 */
export function failureMessage(failure: ApiFailure): string {
  if (failure.class === 'network') {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }
  if (failure.class === 'session') return 'Tu sesión terminó. Ingresa de nuevo.';
  const known = failure.problem === null ? undefined : PROBLEM_MESSAGES[failure.problem.code];
  if (known !== undefined) return known;
  if (failure.class === 'transient') {
    return failure.retryAfterMs === null
      ? 'El servidor no pudo atender ahora. Inténtalo de nuevo en unos segundos.'
      : `El servidor pide esperar ${waitText(failure.retryAfterMs)} antes de volver a intentarlo.`;
  }
  return GENERIC;
}

/**
 * Los problemas de cada campo de una peticion rechazada (`validation-failed`), por puntero (`/fullName`). Cada uno trae una
 * frase en espanol hecha para mostrarse. Si un campo tiene varios problemas se queda con el primero.
 */
export function fieldErrors(failure: ApiFailure): Record<string, string> {
  const result: Record<string, string> = {};
  if (failure.problem === null || failure.problem.code !== 'validation-failed') return result;
  for (const error of failure.problem.errors ?? []) {
    if (!Object.hasOwn(result, error.pointer)) result[error.pointer] = error.detail;
  }
  return result;
}

/** Lo que una pantalla muestra de un fallo: una frase para la persona y el problema de cada campo, por puntero. */
export interface FormProblem {
  /** El tipo de fallo: el de la identidad, el `code` del problema de la API, su clase si no trae uno, o `unexpected`. */
  readonly code: string;
  readonly message: string;
  readonly fields: Readonly<Record<string, string>>;
}

/**
 * Convierte lo que lanzo una accion en lo que se le muestra a la persona. Un error que no es de la API ni del servicio de
 * identidad es un defecto nuestro: se dice algo general y no se repite lo que fue (podria llevar datos).
 */
export function problemOf(error: unknown): FormProblem {
  if (error instanceof AuthError) {
    return { code: error.kind, message: authMessage(error.kind), fields: {} };
  }
  if (error instanceof ApiError) {
    return {
      code: error.failure.problem?.code ?? error.failure.class,
      message: failureMessage(error.failure),
      fields: fieldErrors(error.failure),
    };
  }
  return { code: 'unexpected', message: GENERIC, fields: {} };
}

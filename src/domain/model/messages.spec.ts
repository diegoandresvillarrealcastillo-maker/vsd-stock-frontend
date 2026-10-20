import { describe, expect, it } from 'vitest';
import type { ApiFailure } from './api-error';
import type { AuthFailureKind } from './auth-failure';
import { ApiError } from './api-error';
import { AuthError } from './auth-failure';
import {
  DeviceNotRegisteredError,
  EmptySaleError,
  NoOpenShiftError,
  NoWorkspaceError,
  ShiftAlreadyOpenError,
  ShiftRequiredError,
} from './local-errors';
import { authMessage, failureMessage, fieldErrors, problemOf } from './messages';
import type { Problem } from './problem';

const problem = (code: string, errors?: Problem['errors']): Problem => ({
  type: `urn:vsd-stock:problem:${code}`,
  title: 't',
  status: 400,
  detail: 'texto del servidor que no se le muestra a nadie',
  instance: '/v1/x',
  code,
  traceId: 'trace-1',
  ...(errors === undefined ? {} : { errors }),
});

const failure = (overrides: Partial<ApiFailure> = {}): ApiFailure => ({
  class: 'permanent',
  status: 400,
  problem: null,
  retryAfterMs: null,
  ...overrides,
});

describe('what the person is told when signing in or up fails', () => {
  const kinds: AuthFailureKind[] = [
    'invalid-credentials',
    'email-taken',
    'weak-password',
    'invalid-email',
    'email-not-confirmed',
    'signup-disabled',
    'rate-limited',
    'unavailable',
    'network',
    'unknown',
  ];

  it('has a sentence for every kind, and none of them blames the person for what is not their fault', () => {
    for (const kind of kinds) {
      const text = authMessage(kind);
      expect(text.length).toBeGreaterThan(10);
      expect(text.endsWith('.')).toBe(true);
    }
  });

  it.each([
    ['invalid-credentials', 'El correo o la contraseña no coinciden.'],
    ['email-taken', 'Ese correo ya tiene una cuenta. Ingresa en vez de crear otra.'],
    [
      'email-not-confirmed',
      'Confirma tu correo antes de entrar: te enviamos un enlace al registrarte.',
    ],
    [
      'network',
      'No hay conexión con el servicio de acceso. Revisa tu internet e inténtalo de nuevo.',
    ],
    ['unavailable', 'El servicio de acceso no está disponible ahora. Inténtalo en unos minutos.'],
    ['rate-limited', 'Hubo demasiados intentos. Espera un momento antes de volver a probar.'],
  ] as const)('says %s in words', (kind, words) => {
    expect(authMessage(kind)).toBe(words);
  });
});

describe('what the person is told when the API refuses', () => {
  it.each([
    ['validation-failed', 'Revisa los datos marcados.'],
    ['forbidden', 'Tu rol no permite hacer esto.'],
    ['user-inactive', 'Tu acceso fue dado de baja. Habla con quien administra el negocio.'],
    ['already-member', 'Esa persona ya trabaja en un negocio.'],
    ['no-membership', 'Primero crea un negocio o canjea una invitación.'],
    ['person-not-found', 'Esa persona ya no está en el negocio.'],
    [
      'last-owner',
      'El negocio no puede quedarse sin un dueño activo. Nombra a otra persona como dueño primero.',
    ],
    ['invitation-not-found', 'Ese código no existe o ya se usó. Revísalo o pide uno nuevo.'],
    ['invitation-expired', 'Ese código venció. Pídele uno nuevo a quien te invitó.'],
    ['invitation-not-pending', 'Esa persona ya canjeó su invitación: no hay código que renovar.'],
    ['category-not-found', 'Esa categoría ya no existe.'],
    ['product-not-found', 'Ese producto ya no existe en tu negocio.'],
    ['category-name-taken', 'Ya hay una categoría con ese nombre.'],
    [
      'category-in-use',
      'La categoría todavía tiene productos. Muévelos a otra categoría o archívalos antes de borrarla.',
    ],
    ['sku-taken', 'Ese SKU ya lo tiene otro producto.'],
    ['barcode-taken', 'Ese código de barras ya lo tiene otro producto.'],
    [
      'unit-locked',
      'La unidad no se puede cambiar porque el producto ya tiene movimientos de existencias.',
    ],
    ['supplier-not-found', 'Ese proveedor ya no existe en tu negocio.'],
    ['purchase-not-found', 'Esa compra no existe en tu negocio.'],
    [
      'supplier-in-use',
      'Ese proveedor ya tiene compras y no se puede borrar. Cámbiale el nombre si hace falta.',
    ],
    [
      'operation-id-reused',
      'Esto ya se había registrado con otros datos. Revisa lo que ya quedó guardado antes de repetirlo.',
    ],
  ])('says %s in words, by its code and never by the text of the server', (code, words) => {
    expect(failureMessage(failure({ problem: problem(code) }))).toBe(words);
  });

  it('says there is no connection when the server did not answer', () => {
    expect(failureMessage(failure({ class: 'network', status: null }))).toBe(
      'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
    );
  });

  it('says to try again when the server failed for a moment', () => {
    expect(failureMessage(failure({ class: 'transient', status: 503 }))).toBe(
      'El servidor no pudo atender ahora. Inténtalo de nuevo en unos segundos.',
    );
  });

  it('says how long to wait when the server asked for it', () => {
    expect(failureMessage(failure({ class: 'transient', status: 429, retryAfterMs: 20_000 }))).toBe(
      'El servidor pide esperar 20 segundos antes de volver a intentarlo.',
    );
    expect(failureMessage(failure({ class: 'transient', status: 429, retryAfterMs: 1000 }))).toBe(
      'El servidor pide esperar 1 segundo antes de volver a intentarlo.',
    );
    expect(failureMessage(failure({ class: 'transient', status: 429, retryAfterMs: 90_000 }))).toBe(
      'El servidor pide esperar 2 minutos antes de volver a intentarlo.',
    );
  });

  it('says the session ended when the API no longer accepts it', () => {
    expect(failureMessage(failure({ class: 'session', status: 401 }))).toBe(
      'Tu sesión terminó. Ingresa de nuevo.',
    );
  });

  it('does not show a code it does not know, nor the text the server sent', () => {
    const text = failureMessage(failure({ problem: problem('algo-nuevo') }));

    expect(text).toBe(
      'No pudimos completar esto. Inténtalo de nuevo; si sigue igual, avisa a quien administra el sistema.',
    );
    expect(text).not.toContain('algo-nuevo');
    expect(text).not.toContain('servidor que no');
  });

  it('gives an unknown failure the same sentence', () => {
    expect(failureMessage(failure())).toContain('No pudimos completar esto.');
  });
});

describe('the problems of each field', () => {
  it('maps every pointer of a validation failure to the sentence the server wrote for it', () => {
    const errors = [
      { pointer: '/fullName', code: 'blank', detail: 'El nombre no puede quedar en blanco.' },
      { pointer: '/role', code: 'invalid-value', detail: 'El rol no es uno de los permitidos.' },
    ];

    expect(fieldErrors(failure({ problem: problem('validation-failed', errors) }))).toEqual({
      '/fullName': 'El nombre no puede quedar en blanco.',
      '/role': 'El rol no es uno de los permitidos.',
    });
  });

  it('keeps the first sentence when a field has several problems', () => {
    const errors = [
      { pointer: '/code', code: 'blank', detail: 'primera' },
      { pointer: '/code', code: 'too-long', detail: 'segunda' },
    ];

    expect(fieldErrors(failure({ problem: problem('validation-failed', errors) }))).toEqual({
      '/code': 'primera',
    });
  });

  it('is empty for any other failure', () => {
    expect(fieldErrors(failure({ problem: problem('forbidden') }))).toEqual({});
    expect(fieldErrors(failure({ problem: null }))).toEqual({});
    expect(fieldErrors(failure({ problem: problem('validation-failed') }))).toEqual({});
  });
});

describe('what any error that reaches a form becomes', () => {
  it('turns a failure of the identity service into its sentence, with no field marked', () => {
    expect(problemOf(new AuthError('invalid-credentials'))).toEqual({
      code: 'invalid-credentials',
      message: 'El correo o la contraseña no coinciden.',
      fields: {},
    });
  });

  it('turns a failure of the API into its sentence and the problems of its fields', () => {
    const error = new ApiError(
      failure({
        problem: problem('validation-failed', [
          {
            pointer: '/businessName',
            code: 'blank',
            detail: 'El nombre no puede quedar en blanco.',
          },
        ]),
      }),
    );

    expect(problemOf(error)).toEqual({
      code: 'validation-failed',
      message: 'Revisa los datos marcados.',
      fields: { '/businessName': 'El nombre no puede quedar en blanco.' },
    });
  });

  it.each([
    [new ShiftAlreadyOpenError(), 'shift-already-open', 'Ya hay un turno abierto en este equipo.'],
    [new NoOpenShiftError(), 'no-open-shift', 'No hay un turno abierto que cerrar.'],
    [
      new ShiftRequiredError(),
      'shift-required',
      'Abre un turno para vender: cada venta queda en un turno de caja.',
    ],
    [
      new EmptySaleError(),
      'empty-sale',
      'La venta está vacía. Busca un producto o lee su código para agregarlo.',
    ],
    [
      new DeviceNotRegisteredError(),
      'device-not-registered',
      'Este equipo todavía no está registrado. Conéctate a internet una vez para registrarlo.',
    ],
    [
      new NoWorkspaceError(),
      'no-workspace',
      'Nadie está trabajando en este equipo. Entra de nuevo.',
    ],
  ])(
    'says in its own words what happened with the shift of this device: %s',
    (error, code, message) => {
      expect(problemOf(error)).toEqual({ code, message, fields: {} });
    },
  );

  it('says something general, and nothing of what it was, when it is a defect of ours', () => {
    const result = problemOf(new TypeError('x is not a function'));

    expect(result.message).toContain('No pudimos completar esto.');
    expect(result.message).not.toContain('x is not a function');
    expect(result.fields).toEqual({});
    expect(result.code).toBe('unexpected');
  });

  it('says something general for something that is not even an error', () => {
    expect(problemOf('texto').message).toContain('No pudimos completar esto.');
  });

  it('keeps the code of the problem so the screen can decide where to put it, and the class when there is none', () => {
    expect(problemOf(new ApiError(failure({ problem: problem('invitation-expired') }))).code).toBe(
      'invitation-expired',
    );
    expect(problemOf(new ApiError(failure({ class: 'network', status: null }))).code).toBe(
      'network',
    );
  });

  describe('how long the server asks to wait', () => {
    const wait = (retryAfterMs: number | null) =>
      failureMessage(failure({ class: 'transient', status: 429, retryAfterMs }));

    it.each([
      [0, 'El servidor pide esperar 1 segundo antes de volver a intentarlo.'],
      [400, 'El servidor pide esperar 1 segundo antes de volver a intentarlo.'],
      [1_500, 'El servidor pide esperar 2 segundos antes de volver a intentarlo.'],
      [59_000, 'El servidor pide esperar 59 segundos antes de volver a intentarlo.'],
      [60_000, 'El servidor pide esperar 1 minuto antes de volver a intentarlo.'],
      [120_000, 'El servidor pide esperar 2 minutos antes de volver a intentarlo.'],
    ])('says %i ms as «%s»', (milliseconds, words) => {
      expect(wait(milliseconds)).toBe(words);
    });
  });

  describe('a code the server sends that this client does not know', () => {
    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
      'does not take «%s» for a code with a sentence: it says something general',
      (code) => {
        const message = failureMessage(failure({ problem: problem(code) }));

        expect(typeof message).toBe('string');
        expect(message).toBe(
          'No pudimos completar esto. Inténtalo de nuevo; si sigue igual, avisa a quien administra el sistema.',
        );
      },
    );
  });

  describe('the problems of each field, again', () => {
    it('only a validation failure carries fields: another code with errors does not', () => {
      const withErrors = failure({
        problem: problem('forbidden', [{ pointer: '/x', code: 'c', detail: 'no' }]),
      });

      expect(fieldErrors(withErrors)).toEqual({});
    });

    it('reads a pointer that is also the name of something every object has', () => {
      const withErrors = failure({
        problem: problem('validation-failed', [
          { pointer: 'toString', code: 'c', detail: 'primero' },
          { pointer: 'toString', code: 'c', detail: 'segundo' },
        ]),
      });

      expect(fieldErrors(withErrors)).toEqual({ toString: 'primero' });
    });
  });
});

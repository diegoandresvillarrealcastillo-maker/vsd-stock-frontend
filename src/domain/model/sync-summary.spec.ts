import { describe, expect, it } from 'vitest';
import type { SyncState } from '../ports/in/sync-engine';
import { summarizeSync } from './sync-summary';

// Las horas se dicen en la hora del dispositivo: se arman con ella para que la prueba no dependa de donde corra.
const NOW = new Date(2026, 9, 19, 15, 30);

const state = (change: Partial<SyncState> = {}): SyncState => ({
  phase: 'idle',
  pending: 0,
  attention: 0,
  lastSyncedAt: null,
  sessionExpired: false,
  nextTryAt: null,
  fault: null,
  ...change,
});

describe('what the device says about sending', () => {
  describe('when all is well', () => {
    it('says everything was sent, and when, once the server has accepted something', () => {
      const summary = summarizeSync('online', state({ lastSyncedAt: NOW }));

      expect(summary).toMatchObject({ tone: 'ok', headline: 'Todo enviado', action: null });
      expect(summary.detail).toBe('Última vez: 19 oct, 3:30 p. m.');
    });

    it('says there is nothing to send, without claiming that anything was sent, when nothing ever was', () => {
      expect(summarizeSync('online', state())).toMatchObject({
        tone: 'ok',
        headline: 'Nada por enviar',
        detail: null,
      });
    });

    it('says the same while offline when nothing waits: there is nothing to lose', () => {
      expect(summarizeSync('offline', state())).toMatchObject({ headline: 'Nada por enviar' });
      expect(summarizeSync('checking', state())).toMatchObject({ headline: 'Nada por enviar' });
    });
  });

  describe('what waits', () => {
    it('says how many wait for the connection, in the singular and in the plural, and that they are only here', () => {
      const one = summarizeSync('offline', state({ pending: 1 }));
      const many = summarizeSync('offline', state({ pending: 3 }));

      expect(one).toMatchObject({ tone: 'warn', headline: 'Sin conexión' });
      expect(one.detail).toBe('1 registro por enviar. Está guardado solo en este equipo.');
      expect(many.detail).toBe('3 registros por enviar. Están guardados solo en este equipo.');
    });

    it('says it is about to send when it is online and something waits', () => {
      const summary = summarizeSync('online', state({ pending: 2 }));

      expect(summary).toMatchObject({ tone: 'info', headline: 'Por enviar' });
      expect(summary.detail).toBe('2 registros por enviar.');
    });

    it('does not say that it is online while it is only checking', () => {
      expect(summarizeSync('checking', state({ pending: 2 }))).toMatchObject({
        headline: 'Comprobando conexión…',
        detail: '2 registros por enviar.',
      });
    });
  });

  describe('while sending', () => {
    it('says it is sending, and how many are left', () => {
      const summary = summarizeSync('online', state({ phase: 'sending', pending: 4 }));

      expect(summary).toMatchObject({ tone: 'info', headline: 'Enviando…' });
      expect(summary.detail).toBe('4 registros por enviar.');
    });
  });

  describe('when sending failed', () => {
    it('says so, when it will try again, and lets the person try now', () => {
      const summary = summarizeSync(
        'online',
        state({ phase: 'waiting', pending: 2, nextTryAt: NOW }),
      );

      expect(summary).toMatchObject({
        tone: 'warn',
        headline: 'No se pudo enviar',
        action: 'retry',
      });
      expect(summary.detail).toContain('2 registros por enviar');
      expect(summary.detail).toContain('Vamos a reintentar a las 3:30 p. m.');
    });

    it('says what the server answered when it refused the whole request', () => {
      const summary = summarizeSync(
        'online',
        state({
          phase: 'waiting',
          pending: 1,
          nextTryAt: NOW,
          fault: { status: 413, code: 'payload-too-large' },
        }),
      );

      expect(summary.detail).toContain('payload-too-large');
    });

    it('says the status when the server gave no code', () => {
      const summary = summarizeSync(
        'online',
        state({ phase: 'waiting', pending: 1, fault: { status: 502, code: null } }),
      );

      expect(summary.detail).toContain('El servidor respondió 502.');
    });

    it('has nothing to add, and says nothing, when it knows neither what waits nor why it failed', () => {
      expect(summarizeSync('online', state({ phase: 'waiting' })).detail).toBeNull();
    });

    it('does not promise a time it does not have', () => {
      const summary = summarizeSync('online', state({ phase: 'waiting', pending: 1 }));

      expect(summary.detail).not.toContain('reintentar a las');
    });

    it('says first that there is no connection, which is why it did not go through', () => {
      const summary = summarizeSync('offline', state({ phase: 'waiting', pending: 1 }));

      expect(summary).toMatchObject({ headline: 'Sin conexión', action: null });
    });

    it('does not offer to try again when the last record left and there is no connection to try with', () => {
      expect(summarizeSync('offline', state({ phase: 'waiting' })).action).toBeNull();
      expect(summarizeSync('checking', state({ phase: 'waiting' })).action).toBeNull();
    });
  });

  describe('what needs attention', () => {
    it('says how many the server did not accept, and that someone has to look at them', () => {
      const one = summarizeSync('online', state({ attention: 1 }));
      const many = summarizeSync('online', state({ attention: 2 }));

      expect(one).toMatchObject({ tone: 'warn', headline: '1 requiere atención' });
      expect(many.headline).toBe('2 requieren atención');
      expect(one.detail).toContain('El servidor no la aceptó');
      expect(many.detail).toContain('El servidor no las aceptó');
    });

    it('also says what still waits, when both happen', () => {
      const summary = summarizeSync('offline', state({ attention: 1, pending: 2 }));

      expect(summary.headline).toBe('1 requiere atención');
      expect(summary.detail).toContain('2 registros por enviar');
    });

    it('lets the person try again only when the sending is what failed', () => {
      expect(summarizeSync('online', state({ attention: 1 })).action).toBeNull();
      expect(
        summarizeSync('online', state({ attention: 1, phase: 'waiting', pending: 1 })).action,
      ).toBe('retry');
    });

    it('does not offer to try again while there is no connection to try with: the button would do nothing', () => {
      const failed = state({ attention: 1, phase: 'waiting', pending: 1 });

      expect(summarizeSync('offline', failed).action).toBeNull();
      expect(summarizeSync('checking', failed).action).toBeNull();
    });

    it('comes before the connection: a problem to solve matters more than being offline', () => {
      expect(summarizeSync('offline', state({ attention: 1 })).headline).toBe(
        '1 requiere atención',
      );
    });
  });

  describe('when the session expired', () => {
    it('comes before everything: nothing is sent until the person signs in again, and nothing is lost', () => {
      const summary = summarizeSync(
        'online',
        state({ sessionExpired: true, pending: 3, attention: 1, phase: 'waiting' }),
      );

      expect(summary).toMatchObject({
        tone: 'warn',
        headline: 'Tu sesión caducó',
        action: 'sign-in',
      });
      expect(summary.detail).toContain('3 registros por enviar');
      expect(summary.detail).toContain('no se pierden');
    });

    it('says it even when nothing waits', () => {
      expect(summarizeSync('online', state({ sessionExpired: true }))).toMatchObject({
        headline: 'Tu sesión caducó',
        detail: 'Entra de nuevo para seguir enviando.',
      });
    });
  });

  describe('when the counter was resumed without a connection and there is no session at all', () => {
    const signedOut = { signedIn: false };

    it('says what is missing, the password, and not that a session expired: there was none', () => {
      const summary = summarizeSync(
        'online',
        state({ sessionExpired: true, pending: 3 }),
        signedOut,
      );

      expect(summary).toMatchObject({
        tone: 'warn',
        headline: 'Falta entrar con tu contraseña',
        action: 'sign-in',
      });
      expect(summary.detail).toBe(
        '3 registros por enviar. Entra con tu contraseña para enviarlos. Los registros guardados no se pierden.',
      );
    });

    it('says it in the singular, and when nothing waits it only says what to do', () => {
      expect(
        summarizeSync('online', state({ sessionExpired: true, pending: 1 }), signedOut).detail,
      ).toBe(
        '1 registro por enviar. Entra con tu contraseña para enviarlo. Los registros guardados no se pierden.',
      );
      expect(summarizeSync('online', state({ sessionExpired: true }), signedOut).detail).toBe(
        'Entra con tu contraseña para seguir enviando.',
      );
    });

    it('still comes before everything else', () => {
      const summary = summarizeSync(
        'online',
        state({ sessionExpired: true, pending: 3, attention: 1, phase: 'waiting' }),
        signedOut,
      );

      expect(summary.headline).toBe('Falta entrar con tu contraseña');
    });

    it('changes nothing when nothing was refused for lack of a session', () => {
      expect(summarizeSync('online', state({ pending: 2 }), signedOut)).toMatchObject({
        headline: 'Por enviar',
        action: null,
      });
      expect(summarizeSync('offline', state({ pending: 2 }), signedOut).headline).toBe(
        'Sin conexión',
      );
    });

    it('is what a person with a session gets when nothing says otherwise', () => {
      expect(summarizeSync('online', state({ sessionExpired: true }), { signedIn: true })).toEqual(
        summarizeSync('online', state({ sessionExpired: true })),
      );
    });
  });
});

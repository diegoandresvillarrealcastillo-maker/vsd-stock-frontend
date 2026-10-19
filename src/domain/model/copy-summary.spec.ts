import { describe, expect, it } from 'vitest';
import { summarizeCopy, type CopyFacts } from './copy-summary';

// Las horas se dicen en la hora del dispositivo: se arman con ella para que la prueba no dependa de donde corra.
const CATALOG_AT = new Date(2026, 9, 19, 15, 30);
const STOCK_AT = new Date(2026, 9, 19, 15, 31);

const facts = (change: Partial<CopyFacts> = {}): CopyFacts => ({
  status: 'ready',
  productCount: 120,
  productsAsOf: CATALOG_AT,
  stockAsOf: STOCK_AT,
  downloading: false,
  fault: null,
  ...change,
});
const empty = (change: Partial<CopyFacts> = {}): CopyFacts =>
  facts({ status: 'empty', productCount: 0, productsAsOf: null, stockAsOf: null, ...change });

describe('what the device says about the catalog it keeps', () => {
  describe('when there is one and nothing is wrong', () => {
    it('says how many products it has and from what hour the catalog and the stock are', () => {
      expect(summarizeCopy(facts())).toEqual({
        tone: 'ok',
        headline: '120 productos en este equipo',
        detail: 'Catálogo al 19 oct, 3:30 p. m. Existencias al 19 oct, 3:31 p. m.',
        canRefresh: true,
      });
    });

    it('talks in the singular when there is one product', () => {
      expect(summarizeCopy(facts({ productCount: 1 })).headline).toBe('1 producto en este equipo');
    });

    it('says the stock was not downloaded when only the catalog was', () => {
      expect(summarizeCopy(facts({ stockAsOf: null })).detail).toBe(
        'Catálogo al 19 oct, 3:30 p. m. Las existencias todavía no se bajaron.',
      );
    });
  });

  describe('when there is nothing yet', () => {
    it('says so, and that it is downloaded by itself when there is a connection', () => {
      expect(summarizeCopy(empty())).toEqual({
        tone: 'info',
        headline: 'Todavía no hay catálogo en este equipo',
        detail: 'Se descarga solo cuando hay conexión. Sin él no se puede vender sin conexión.',
        canRefresh: true,
      });
    });
  });

  describe('while downloading', () => {
    it('says it is downloading when there is nothing yet, and does not offer to do it again', () => {
      expect(summarizeCopy(empty({ downloading: true }))).toEqual({
        tone: 'info',
        headline: 'Descargando el catálogo…',
        detail: null,
        canRefresh: false,
      });
    });

    it('says it is updating when there is already a catalog, and keeps saying from when it is', () => {
      expect(summarizeCopy(facts({ downloading: true }))).toEqual({
        tone: 'info',
        headline: 'Actualizando el catálogo…',
        detail: '120 productos, del 19 oct, 3:30 p. m.',
        canRefresh: false,
      });
    });
  });

  describe('when it could not be updated', () => {
    it('says there is no connection, and that the one it has is still good to sell with', () => {
      expect(summarizeCopy(facts({ fault: 'network' }))).toEqual({
        tone: 'warn',
        headline: 'No se pudo actualizar: sin conexión',
        detail: 'Sigues con el catálogo del 19 oct, 3:30 p. m.',
        canRefresh: true,
      });
    });

    it('says there is no catalog, and that without it nothing can be sold without a connection', () => {
      expect(summarizeCopy(empty({ fault: 'network' }))).toEqual({
        tone: 'warn',
        headline: 'Sin conexión y sin catálogo en este equipo',
        detail: 'Conéctate para descargarlo: sin él no se puede vender sin conexión.',
        canRefresh: true,
      });
    });

    it('says the session expired, and that signing in again is what updates it', () => {
      expect(summarizeCopy(facts({ fault: 'session' }))).toEqual({
        tone: 'warn',
        headline: 'Tu sesión caducó',
        detail: 'Sigues con el catálogo del 19 oct, 3:30 p. m. Entra de nuevo para actualizarlo.',
        canRefresh: false,
      });
      expect(summarizeCopy(empty({ fault: 'session' }))).toEqual({
        tone: 'warn',
        headline: 'Tu sesión caducó',
        detail: 'Todavía no hay catálogo en este equipo. Entra de nuevo para descargarlo.',
        canRefresh: false,
      });
    });

    it('says it did not work for another reason, and lets the person try again', () => {
      expect(summarizeCopy(facts({ fault: 'other' }))).toEqual({
        tone: 'warn',
        headline: 'No se pudo actualizar el catálogo',
        detail: 'Sigues con el del 19 oct, 3:30 p. m. Inténtalo de nuevo.',
        canRefresh: true,
      });
      expect(summarizeCopy(empty({ fault: 'other' }))).toEqual({
        tone: 'warn',
        headline: 'No se pudo descargar el catálogo',
        detail: 'Todavía no hay catálogo en este equipo. Inténtalo de nuevo.',
        canRefresh: true,
      });
    });

    it('says it is downloading first, even if the last time failed', () => {
      expect(summarizeCopy(facts({ downloading: true, fault: 'network' })).headline).toBe(
        'Actualizando el catálogo…',
      );
    });
  });
});

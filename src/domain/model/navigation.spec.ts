import { describe, expect, it } from 'vitest';
import { NAVIGATION, navigationFor } from './navigation';
import { ACTIONS, ROLES, can } from './permissions';

const idsFor = (role: (typeof ROLES)[number]) => navigationFor(role).map((item) => item.id);

describe('what the menu offers each role', () => {
  it('offers every role the home page first', () => {
    for (const role of ROLES) {
      expect(navigationFor(role)[0]?.id).toBe('home');
    }
  });

  it('offers a cashier the catalog and the stock to look at, but not what only the management does', () => {
    expect(idsFor('cashier')).toEqual(['home', 'catalog', 'inventory']);
  });

  it('offers the management purchases, the monthly report and the people too', () => {
    const all = ['home', 'catalog', 'inventory', 'purchases', 'reports', 'people'];
    expect(idsFor('admin')).toEqual(all);
    expect(idsFor('owner')).toEqual(all);
  });

  it('does not offer the report to a cashier: it is for whoever has report:sales', () => {
    expect(idsFor('cashier')).not.toContain('reports');
    expect(NAVIGATION.find((item) => item.id === 'reports')).toMatchObject({
      path: '/reportes',
      label: 'Reportes',
      action: 'report:sales',
    });
  });

  it('only ever offers what the permission table of the backend lets that role do', () => {
    for (const role of ROLES) {
      for (const item of navigationFor(role)) {
        expect(can(role, item.action), `${role} · ${item.id}`).toBe(true);
      }
    }
  });

  it('names an action that exists for every item: a typo here would hide a screen from everybody', () => {
    for (const item of NAVIGATION) {
      expect(Object.hasOwn(ACTIONS, item.action), item.id).toBe(true);
    }
  });

  it('gives every item its own id and its own path, starting with a slash', () => {
    expect(new Set(NAVIGATION.map((item) => item.id)).size).toBe(NAVIGATION.length);
    expect(new Set(NAVIGATION.map((item) => item.path)).size).toBe(NAVIGATION.length);
    for (const item of NAVIGATION) expect(item.path.startsWith('/')).toBe(true);
  });

  it('says which screens need a connection: all of them until the device has its own copy of the data', () => {
    expect(
      NAVIGATION.filter((item) => item.id !== 'home').every((item) => item.requiresConnection),
    ).toBe(true);
    expect(NAVIGATION.find((item) => item.id === 'home')?.requiresConnection).toBe(false);
  });

  it('finds the item of a path, also when the path goes deeper', async () => {
    const { itemOfPath } = await import('./navigation');

    expect(itemOfPath('/catalogo')?.id).toBe('catalog');
    expect(itemOfPath('/catalogo/abc')?.id).toBe('catalog');
    expect(itemOfPath('/')?.id).toBe('home');
    expect(itemOfPath('/catalogos')).toBeUndefined();
    expect(itemOfPath('/otra-cosa')).toBeUndefined();
  });
});

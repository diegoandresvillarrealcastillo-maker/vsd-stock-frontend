import { describe, expect, it } from 'vitest';
import table from '../../../contract/permissions.json';
import {
  ACTIONS,
  ROLES,
  actionsOf,
  can,
  isAction,
  isAvailableOffline,
  isRole,
} from './permissions';

describe('the permission table (ADR 0017)', () => {
  it('is the table of the backend, not one of our own', () => {
    expect([...ROLES]).toEqual(table.roles);
    expect(Object.keys(ACTIONS).sort()).toEqual(Object.keys(table.actions).sort());
  });

  it.each(Object.entries(table.actions))(
    'gives %s to exactly the roles the backend says',
    (action, entry) => {
      for (const role of ROLES) {
        expect(can(role, action as keyof typeof ACTIONS), `${role} · ${action}`).toBe(
          entry.roles.includes(role),
        );
      }
    },
  );

  it('lets the management do what a cashier cannot, and the owner alone run the business', () => {
    expect(can('cashier', 'product:manage')).toBe(false);
    expect(can('admin', 'product:manage')).toBe(true);
    expect(can('owner', 'product:manage')).toBe(true);
    expect(can('admin', 'user:manage-admins')).toBe(false);
    expect(can('owner', 'user:manage-admins')).toBe(true);
    expect(can('admin', 'business:settings')).toBe(false);
  });

  it('refuses what it does not know, including inherited names', () => {
    expect(isAction('sale:create')).toBe(true);
    expect(isAction('toString')).toBe(false);
    expect(isAction('__proto__')).toBe(false);
    expect(isAction(7)).toBe(false);
    expect(isRole('owner')).toBe(true);
    expect(isRole('constructor')).toBe(false);
    expect(can('cashier', 'toString' as never)).toBe(false);
  });

  it('says which actions work without a connection, and opens them all to the three roles', () => {
    expect(isAvailableOffline('sale:create')).toBe(true);
    expect(isAvailableOffline('product:manage')).toBe(false);
    for (const [action, entry] of Object.entries(table.actions)) {
      if (entry.offline) expect(entry.roles, action).toHaveLength(ROLES.length);
    }
    expect(isAvailableOffline('toString' as never)).toBe(false);
  });

  it('lists what a role can do, a cashier less than an administrator and an administrator less than the owner', () => {
    const cashier = actionsOf('cashier');
    const admin = actionsOf('admin');
    const owner = actionsOf('owner');

    expect(cashier).toContain('sale:create');
    expect(cashier).not.toContain('product:manage');
    expect(cashier.every((action) => admin.includes(action))).toBe(true);
    expect(admin.every((action) => owner.includes(action))).toBe(true);
    expect(owner.length).toBeGreaterThan(admin.length);
    expect(admin.length).toBeGreaterThan(cashier.length);
  });
});

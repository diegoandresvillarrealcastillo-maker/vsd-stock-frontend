import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import {
  DeviceNotRegisteredError,
  LocalKeyLostError,
  NoWorkspaceError,
} from '../../domain/model/local-errors';
import { COUNTER_RESUME_WINDOW_MS, type LocalProfile } from '../../domain/model/local-profile';
import type { Me } from '../../domain/model/me';
import type { Clock } from '../../domain/ports/out/clock';
import {
  FakeDeviceRegistry,
  FakeLocalStores,
  MemoryPointer,
  SequentialIds,
} from '../../../test/support/fake-local';
import { LocalWorkspaceUseCase } from './local-workspace.usecase';

const AUTH_ID = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';
const OTHER_AUTH_ID = '7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c';
const NOW = new Date('2026-10-19T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const me = (overrides: Partial<Me['identity']> = {}): Me => ({
  identity: { id: AUTH_ID, email: 'ana@ejemplo.co', ...overrides },
  membership: {
    userId: '11111111-1111-4111-8111-111111111111',
    businessId: '22222222-2222-4222-8222-222222222222',
    businessName: 'Tienda La Esquina',
    role: 'cashier',
    fullName: 'Ana Gómez',
  },
});

const profileAt = (verifiedAt: Date, authUserId = AUTH_ID): LocalProfile => ({
  authUserId,
  email: 'ana@ejemplo.co',
  userId: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  businessName: 'Tienda La Esquina',
  role: 'cashier',
  fullName: 'Ana Gómez',
  verifiedAt: verifiedAt.toISOString(),
});

function setup(now: Date = NOW) {
  const current = { value: now };
  const clock: Clock = { now: () => current.value };
  const stores = new FakeLocalStores();
  const pointer = new MemoryPointer();
  const registry = new FakeDeviceRegistry();
  const workspace = new LocalWorkspaceUseCase({
    stores,
    pointer,
    registry,
    clock,
    ids: new SequentialIds(),
  });
  return { stores, pointer, registry, workspace, current };
}

describe('LocalWorkspaceUseCase', () => {
  describe('who worked here last', () => {
    it('is nobody when nobody ever entered', async () => {
      const { workspace } = setup();

      expect(await workspace.lastPerson()).toEqual({ state: 'none' });
    });

    it('is nobody when the pointer names a person whose base has no profile', async () => {
      const { workspace, pointer, stores } = setup();
      pointer.set(AUTH_ID);

      expect(await workspace.lastPerson()).toEqual({ state: 'none' });
      expect(stores.lastStore.closed).toBe(true);
    });

    it('is the person with their profile and how much of the seventy-two hours is left', async () => {
      const { workspace, pointer, stores, current } = setup();
      const profile = profileAt(new Date(NOW.getTime() - 10 * HOUR));
      stores.dataOf(AUTH_ID).profile = profile;
      pointer.set(AUTH_ID);
      current.value = NOW;

      const found = await workspace.lastPerson();

      expect(found).toEqual({
        state: 'available',
        profile,
        access: { state: 'open', remainingMs: COUNTER_RESUME_WINDOW_MS - 10 * HOUR },
      });
    });

    it('says when the counter is locked, and still gives the person so the screen can name them', async () => {
      const { workspace, pointer, stores } = setup();
      const profile = profileAt(new Date(NOW.getTime() - COUNTER_RESUME_WINDOW_MS - HOUR));
      stores.dataOf(AUTH_ID).profile = profile;
      pointer.set(AUTH_ID);

      const found = await workspace.lastPerson();

      expect(found).toEqual({
        state: 'available',
        profile,
        access: { state: 'locked', reason: 'expired' },
      });
    });

    it('closes the base after reading it, and does not make it the active one', async () => {
      const { workspace, pointer, stores } = setup();
      stores.dataOf(AUTH_ID).profile = profileAt(NOW);
      pointer.set(AUTH_ID);

      await workspace.lastPerson();

      expect(stores.lastStore.closed).toBe(true);
      expect(workspace.current()).toBeNull();
    });

    it('is nobody, without failing, when the base can not be opened', async () => {
      const { workspace, pointer, stores } = setup();
      pointer.set(AUTH_ID);
      stores.failOpen = new Error('IndexedDB no esta disponible');

      expect(await workspace.lastPerson()).toEqual({ state: 'none' });
    });
  });

  describe('beginning, once the server confirmed the person', () => {
    it('opens their base, notes that they were verified now and makes them the person of this device', async () => {
      const { workspace, pointer, stores } = setup();

      await workspace.begin(me());

      expect(stores.opened).toEqual([AUTH_ID]);
      expect(stores.dataOf(AUTH_ID).profile).toEqual(profileAt(NOW));
      expect(pointer.get()).toBe(AUTH_ID);
      expect(workspace.current()).toEqual({
        profile: profileAt(NOW),
        deviceCode: null,
        resumed: false,
      });
    });

    it('knows the device code when the person already had registered this device', async () => {
      const { workspace, stores } = setup();
      stores.dataOf(AUTH_ID).device = { id: 'dev-1', code: 'AB' };

      await workspace.begin(me());

      expect(workspace.current()?.deviceCode).toBe('AB');
    });

    it('does not take a device that was never given a code as registered', async () => {
      const { workspace, stores } = setup();
      stores.dataOf(AUTH_ID).device = { id: 'dev-1', code: null };

      await workspace.begin(me());

      expect(workspace.current()?.deviceCode).toBeNull();
    });

    it('does nothing for someone without a business: there is no counter for them', async () => {
      const { workspace, pointer, stores } = setup();

      await workspace.begin({ ...me(), membership: null });

      expect(stores.opened).toEqual([]);
      expect(pointer.get()).toBeNull();
      expect(workspace.current()).toBeNull();
    });

    it('renews the verification each time the person enters with a connection', async () => {
      const { workspace, stores, current } = setup();
      await workspace.begin(me());
      await workspace.leave();
      current.value = new Date(NOW.getTime() + 20 * HOUR);

      await workspace.begin(me());

      expect(stores.dataOf(AUTH_ID).profile?.verifiedAt).toBe(current.value.toISOString());
    });

    it('lets go of the previous base when another person enters, without forgetting it', async () => {
      const { workspace, stores, pointer } = setup();
      await workspace.begin(me());
      const first = stores.lastStore;

      await workspace.begin(me({ id: OTHER_AUTH_ID, email: 'luis@ejemplo.co' }));

      expect(first.closed).toBe(true);
      expect(stores.forgotten).toEqual([]);
      expect(stores.people.has(AUTH_ID)).toBe(true);
      expect(pointer.get()).toBe(OTHER_AUTH_ID);
      expect(workspace.current()?.profile.authUserId).toBe(OTHER_AUTH_ID);
    });

    it('tells those who listen every time the workspace changes', async () => {
      const { workspace } = setup();
      const listener = vi.fn();
      const stop = workspace.subscribe(listener);

      await workspace.begin(me());
      await workspace.leave();
      stop();
      await workspace.begin(me());

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('does not leave a person half entered when the key was lost: the error goes up and nobody is current', async () => {
      const { workspace, pointer, stores } = setup();
      stores.dataOf(AUTH_ID).pending = 3;
      stores.keyLostFor = AUTH_ID;

      await expect(workspace.begin(me())).rejects.toMatchObject({
        name: 'LocalKeyLostError',
        pending: 3,
      });
      await expect(workspace.begin(me())).rejects.toBeInstanceOf(LocalKeyLostError);

      expect(workspace.current()).toBeNull();
      expect(pointer.get()).toBeNull();
    });
  });

  describe('discarding what can not be read', () => {
    it('deletes the base of the person that lost its key and begins again with an empty one', async () => {
      const { workspace, stores, pointer } = setup();
      stores.dataOf(AUTH_ID).pending = 3;
      stores.keyLostFor = AUTH_ID;
      await expect(workspace.begin(me())).rejects.toBeInstanceOf(LocalKeyLostError);
      stores.keyLostFor = null;

      await workspace.discard(me());

      expect(stores.forgotten).toEqual([AUTH_ID]);
      expect(stores.dataOf(AUTH_ID).pending).toBe(0);
      expect(workspace.current()?.profile.authUserId).toBe(AUTH_ID);
      expect(pointer.get()).toBe(AUTH_ID);
    });

    it('leaves the base of any other person alone', async () => {
      const { workspace, stores } = setup();
      await workspace.begin(me({ id: OTHER_AUTH_ID }));
      await workspace.leave();

      await workspace.discard(me());

      expect(stores.forgotten).toEqual([AUTH_ID]);
      expect(stores.people.has(OTHER_AUTH_ID)).toBe(true);
    });

    it('lets go of the base before deleting it when that person was the one working', async () => {
      const { workspace, stores } = setup();
      await workspace.begin(me());
      const first = stores.lastStore;

      await workspace.discard(me());

      expect(first.closed).toBe(true);
      expect(stores.forgotten).toEqual([AUTH_ID]);
      // Se solto ANTES de borrar: una base con una conexion abierta no se deja borrar.
      expect(stores.openAtForget).toEqual([[]]);
    });

    it('does not let go of the base of the person who is working when it is another one that is discarded', async () => {
      const { workspace, stores } = setup();
      await workspace.begin(me({ id: OTHER_AUTH_ID }));

      await workspace.discard(me());

      expect(stores.openAtForget).toEqual([[OTHER_AUTH_ID]]);
    });
  });

  describe('resuming without a connection', () => {
    it('opens the base of the last person and the counter is theirs again, marked as resumed', async () => {
      const { workspace, pointer, stores } = setup();
      stores.dataOf(AUTH_ID).profile = profileAt(new Date(NOW.getTime() - 5 * HOUR));
      stores.dataOf(AUTH_ID).device = { id: 'dev-1', code: 'AA' };
      pointer.set(AUTH_ID);

      await workspace.resume();

      expect(workspace.current()).toEqual({
        profile: profileAt(new Date(NOW.getTime() - 5 * HOUR)),
        deviceCode: 'AA',
        resumed: true,
      });
    });

    it('does not renew the verification: only the server can do that', async () => {
      const { workspace, pointer, stores } = setup();
      const verified = new Date(NOW.getTime() - 5 * HOUR);
      stores.dataOf(AUTH_ID).profile = profileAt(verified);
      pointer.set(AUTH_ID);

      await workspace.resume();

      expect(stores.dataOf(AUTH_ID).profile?.verifiedAt).toBe(verified.toISOString());
    });

    it('refuses after the seventy-two hours, keeps what was saved and says why', async () => {
      const { workspace, pointer, stores } = setup();
      stores.dataOf(AUTH_ID).profile = profileAt(
        new Date(NOW.getTime() - COUNTER_RESUME_WINDOW_MS),
      );
      pointer.set(AUTH_ID);

      await expect(workspace.resume()).rejects.toMatchObject({
        name: 'CounterLockedError',
        reason: 'expired',
      });

      expect(workspace.current()).toBeNull();
      expect(stores.forgotten).toEqual([]);
      expect(stores.lastStore.closed).toBe(true);
    });

    it('refuses when the clock was set back, and says so', async () => {
      const { workspace, pointer, stores } = setup();
      stores.dataOf(AUTH_ID).profile = profileAt(new Date(NOW.getTime() + HOUR));
      pointer.set(AUTH_ID);

      await expect(workspace.resume()).rejects.toMatchObject({
        name: 'CounterLockedError',
        reason: 'clock-behind',
      });
    });

    it('refuses when the time of the last verification can not be read, and says so', async () => {
      const { workspace, pointer, stores } = setup();
      stores.dataOf(AUTH_ID).profile = { ...profileAt(NOW), verifiedAt: 'ayer' };
      pointer.set(AUTH_ID);

      await expect(workspace.resume()).rejects.toMatchObject({
        name: 'CounterLockedError',
        reason: 'unreadable',
      });
    });

    it('has nothing to resume when nobody worked here, and opens no base to find out', async () => {
      const { workspace, stores } = setup();

      await expect(workspace.resume()).rejects.toBeInstanceOf(NoWorkspaceError);

      expect(stores.opened).toEqual([]);
    });

    it('has nothing to resume when the base of the last person has no profile', async () => {
      const { workspace, pointer, stores } = setup();
      pointer.set(AUTH_ID);

      await expect(workspace.resume()).rejects.toBeInstanceOf(NoWorkspaceError);
      expect(stores.lastStore.closed).toBe(true);
    });
  });

  describe('registering the device', () => {
    it('needs someone working here', async () => {
      const { workspace, registry } = setup();

      await expect(workspace.registerDevice()).rejects.toBeInstanceOf(NoWorkspaceError);
      expect(registry.calls).toEqual([]);
    });

    it('invents its identifier, keeps it BEFORE asking and keeps the code the server gives', async () => {
      const { workspace, registry, stores } = setup();
      await workspace.begin(me());
      registry.failNext = new Error('se corto');

      await expect(workspace.registerDevice()).rejects.toThrow('se corto');
      const kept = stores.dataOf(AUTH_ID).device;
      expect(kept).toEqual({ id: '00000000-0000-4000-8000-000000000001', code: null });

      await workspace.registerDevice();

      expect(registry.calls).toEqual([kept?.id, kept?.id]);
      expect(stores.dataOf(AUTH_ID).device).toEqual({ id: kept?.id, code: 'AA' });
      expect(workspace.current()?.deviceCode).toBe('AA');
    });

    it('asks the server once: a device that already has its code is not registered again', async () => {
      const { workspace, registry } = setup();
      await workspace.begin(me());

      await workspace.registerDevice();
      await workspace.registerDevice();

      expect(registry.calls).toHaveLength(1);
    });

    it('lets the failure of the server go up as it came, and leaves the device waiting for its code', async () => {
      const { workspace, registry } = setup();
      await workspace.begin(me());
      const failure = new ApiError({
        class: 'transient',
        status: null,
        problem: null,
        retryAfterMs: null,
      });
      registry.failNext = failure;

      await expect(workspace.registerDevice()).rejects.toBe(failure);

      expect(workspace.current()?.deviceCode).toBeNull();
    });

    it('does not accept that the server registered another device than the one that was asked for', async () => {
      const { workspace, registry, stores } = setup();
      await workspace.begin(me());
      registry.forceId = '99999999-9999-4999-8999-999999999999';

      await expect(workspace.registerDevice()).rejects.toThrow(/another device/);

      expect(stores.dataOf(AUTH_ID).device?.code).toBeNull();
      expect(workspace.current()?.deviceCode).toBeNull();
    });

    it('tells those who listen when it learns the code, and only then', async () => {
      const { workspace } = setup();
      await workspace.begin(me());
      const listener = vi.fn();
      workspace.subscribe(listener);

      await workspace.registerDevice();
      expect(listener).toHaveBeenCalledTimes(1);
      await workspace.registerDevice();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not keep a code that arrives after the person changed: the base is closed and it will be asked again', async () => {
      const { workspace, registry, stores } = setup();
      await workspace.begin(me());
      let release = () => {};
      registry.holdNext = new Promise<void>((resolve) => {
        release = resolve;
      });
      const registering = workspace.registerDevice();
      await vi.waitFor(() => {
        expect(registry.calls).toHaveLength(1);
      });

      await workspace.leave();
      release();
      await registering;

      expect(stores.dataOf(AUTH_ID).device).toEqual({ id: registry.calls[0], code: null });
    });

    it('does not give the code of one person to another who started working meanwhile', async () => {
      const { workspace, stores } = setup();
      await workspace.begin(me());
      // Otra pestaña ya registro el dispositivo mientras esta lo pedia.
      stores.dataOf(AUTH_ID).device = { id: '77777777-7777-4777-8777-777777777777', code: 'AB' };
      let release = () => {};
      stores.holdClaim = new Promise<void>((resolve) => {
        release = resolve;
      });
      const registering = workspace.registerDevice();

      await workspace.begin(me({ id: OTHER_AUTH_ID }));
      release();
      await registering;

      expect(workspace.current()?.profile.authUserId).toBe(OTHER_AUTH_ID);
      expect(workspace.current()?.deviceCode).toBeNull();
    });

    it('does not register again a device that another tab already registered', async () => {
      const { workspace, registry, stores } = setup();
      await workspace.begin(me());
      stores.dataOf(AUTH_ID).device = { id: '77777777-7777-4777-8777-777777777777', code: 'AB' };

      await workspace.registerDevice();

      expect(registry.calls).toEqual([]);
      expect(workspace.current()?.deviceCode).toBe('AB');
    });

    it('refuses a code that is not one', async () => {
      const { workspace, registry, stores } = setup();
      await workspace.begin(me());
      registry.forceCode = 'A0';

      await expect(workspace.registerDevice()).rejects.toBeInstanceOf(RangeError);

      expect(stores.dataOf(AUTH_ID).device?.code).toBeNull();
      expect(workspace.current()?.deviceCode).toBeNull();
    });

    it('is the same device for the two tabs that try at once', async () => {
      const { workspace, registry } = setup();
      await workspace.begin(me());

      await Promise.all([workspace.registerDevice(), workspace.registerDevice()]);

      expect(new Set(registry.calls).size).toBe(1);
      expect(workspace.current()?.deviceCode).toBe('AA');
    });
  });

  describe('the folio of the next sale', () => {
    it('needs someone working here', async () => {
      const { workspace } = setup();

      await expect(workspace.nextFolio()).rejects.toBeInstanceOf(NoWorkspaceError);
    });

    it('needs the device to be registered, and does not spend a number while it is not', async () => {
      const { workspace, stores } = setup();
      await workspace.begin(me());

      await expect(workspace.nextFolio()).rejects.toBeInstanceOf(DeviceNotRegisteredError);

      expect(stores.dataOf(AUTH_ID).serial).toBe(0);
    });

    it('is the code of the device, a dash and a series that only grows', async () => {
      const { workspace } = setup();
      await workspace.begin(me());
      await workspace.registerDevice();

      const folios = [
        await workspace.nextFolio(),
        await workspace.nextFolio(),
        await workspace.nextFolio(),
      ];

      expect(folios).toEqual(['AA-000001', 'AA-000002', 'AA-000003']);
    });

    it('goes on from where it was after leaving and resuming', async () => {
      const { workspace } = setup();
      await workspace.begin(me());
      await workspace.registerDevice();
      await workspace.nextFolio();
      await workspace.nextFolio();
      await workspace.leave();

      await workspace.resume();

      expect(await workspace.nextFolio()).toBe('AA-000003');
    });

    it('never repeats a folio when many are asked for at once', async () => {
      const { workspace } = setup();
      await workspace.begin(me());
      await workspace.registerDevice();

      const folios = await Promise.all(Array.from({ length: 25 }, () => workspace.nextFolio()));

      expect(new Set(folios).size).toBe(25);
    });
  });

  describe('what is waiting to be sent', () => {
    it('needs someone working here', async () => {
      const { workspace } = setup();

      await expect(workspace.pendingCount()).rejects.toBeInstanceOf(NoWorkspaceError);
    });

    it('is what the base of the person holds', async () => {
      const { workspace, stores } = setup();
      stores.dataOf(AUTH_ID).pending = 4;
      await workspace.begin(me());

      expect(await workspace.pendingCount()).toBe(4);
    });
  });

  describe('changing person', () => {
    it('lets go of the base and keeps everything, including who it was, so they can come back', async () => {
      const { workspace, stores, pointer } = setup();
      await workspace.begin(me());
      await workspace.registerDevice();
      const store = stores.lastStore;

      await workspace.leave();

      expect(store.closed).toBe(true);
      expect(stores.forgotten).toEqual([]);
      expect(pointer.get()).toBe(AUTH_ID);
      expect(workspace.current()).toBeNull();
      expect(stores.dataOf(AUTH_ID).device?.code).toBe('AA');
    });

    it('does nothing when nobody is working', async () => {
      const { workspace } = setup();

      await expect(workspace.leave()).resolves.toBeUndefined();
    });
  });

  describe('forgetting', () => {
    it('deletes the base of the person with everything it has and forgets who they were', async () => {
      const { workspace, stores, pointer } = setup();
      await workspace.begin(me());
      const store = stores.lastStore;

      await workspace.forget();

      expect(store.closed).toBe(true);
      expect(stores.forgotten).toEqual([AUTH_ID]);
      expect(stores.people.has(AUTH_ID)).toBe(false);
      expect(pointer.get()).toBeNull();
      expect(workspace.current()).toBeNull();
    });

    it('leaves the other people of the device alone', async () => {
      const { workspace, stores } = setup();
      await workspace.begin(me({ id: OTHER_AUTH_ID }));
      await workspace.leave();
      await workspace.begin(me());

      await workspace.forget();

      expect(stores.forgotten).toEqual([AUTH_ID]);
      expect(stores.people.has(OTHER_AUTH_ID)).toBe(true);
    });

    it('does nothing when nobody is working', async () => {
      const { workspace, stores } = setup();

      await workspace.forget();

      expect(stores.forgotten).toEqual([]);
    });
  });
});

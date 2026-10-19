import { describe, expect, it } from 'vitest';
import {
  CounterLockedError,
  DeviceNotRegisteredError,
  LocalKeyLostError,
  LocalStorageUnavailableError,
  NoWorkspaceError,
} from './local-errors';

describe('the errors of the local workspace', () => {
  it.each(['expired', 'clock-behind', 'unreadable'] as const)(
    'says why the counter can not be resumed: %s',
    (reason) => {
      const error = new CounterLockedError(reason);

      expect(error.reason).toBe(reason);
      expect(error.message).toContain(reason);
      expect(error.name).toBe('CounterLockedError');
    },
  );

  it('says how many records can not be read when the key is lost', () => {
    const error = new LocalKeyLostError(3);

    expect(error.pending).toBe(3);
    expect(error.message).toContain('3 records');
  });

  it('says what the browser lacks', () => {
    const error = new LocalStorageUnavailableError('IndexedDB is missing');

    expect(error.message).toContain('IndexedDB is missing');
  });

  it('has a name that tells them apart once they went through a boundary', () => {
    expect(new NoWorkspaceError().name).toBe('NoWorkspaceError');
    expect(new DeviceNotRegisteredError().name).toBe('DeviceNotRegisteredError');
    expect(new LocalKeyLostError(1).name).toBe('LocalKeyLostError');
    expect(new LocalStorageUnavailableError('x').name).toBe('LocalStorageUnavailableError');
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AesGcmCipher, RecordUnreadableError, generateKey } from './aes-gcm-cipher';

describe('AesGcmCipher', () => {
  it('opens what it sealed under the same name', async () => {
    const cipher = new AesGcmCipher(await generateKey());

    const sealed = await cipher.seal('profile', { nombre: 'Ana', edad: 30 });

    expect(await cipher.open('profile', sealed)).toEqual({ nombre: 'Ana', edad: 30 });
  });

  it('says which record it could not open, so that whoever reads the failure knows what was lost', async () => {
    const cipher = new AesGcmCipher(await generateKey());
    const sealed = await cipher.seal('profile', { a: 1 });

    const failure = await cipher.open('device', sealed).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RecordUnreadableError);
    expect((failure as RecordUnreadableError).recordName).toBe('device');
    expect((failure as RecordUnreadableError).message).toContain('"device"');
  });

  it('does not open with another key', async () => {
    const sealed = await new AesGcmCipher(await generateKey()).seal('profile', { a: 1 });

    await expect(
      new AesGcmCipher(await generateKey()).open('profile', sealed),
    ).rejects.toBeInstanceOf(RecordUnreadableError);
  });

  it('does not give back something that is not JSON, even if it opens', async () => {
    const key = await generateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('profile') },
      key,
      new TextEncoder().encode('esto no es JSON'),
    );

    await expect(new AesGcmCipher(key).open('profile', { iv, data })).rejects.toBeInstanceOf(
      RecordUnreadableError,
    );
  });

  it('uses a new vector every time, even for the same thing under the same name', async () => {
    const cipher = new AesGcmCipher(await generateKey());

    const first = await cipher.seal('profile', { a: 1 });
    const second = await cipher.seal('profile', { a: 1 });

    expect(first.iv).toHaveLength(12);
    expect(Array.from(first.iv)).not.toEqual(Array.from(second.iv));
    expect(Array.from(new Uint8Array(first.data))).not.toEqual(
      Array.from(new Uint8Array(second.data)),
    );
  });
});

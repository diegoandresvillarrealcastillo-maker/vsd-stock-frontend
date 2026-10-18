/**
 * Un registro cifrado tal como se guarda: el vector de inicializacion y el texto cifrado. El nombre del registro NO va aqui: es
 * la clave con que se guarda, y es ademas lo que el cifrado autentica.
 */
export interface Sealed {
  readonly iv: Uint8Array<ArrayBuffer>;
  readonly data: ArrayBuffer;
}

/** El registro no se pudo abrir: otra clave, un bit alterado o un registro copiado al lugar de otro (ADR 0018, punto 1). */
export class RecordUnreadableError extends Error {
  constructor(readonly recordName: string) {
    super(`The record "${recordName}" can not be opened`);
    this.name = 'RecordUnreadableError';
  }
}

/** 96 bits, el tamaño que AES-GCM recomienda para el vector de inicializacion. */
const IV_BYTES = 12;

/** Genera la clave de una persona: AES-GCM de 256 bits que NO se puede exportar (ADR 0018, punto 3). */
export function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * Cifra y descifra el contenido de cada registro con AES-GCM (ADR 0018, punto 1): un vector nuevo y aleatorio por registro, y el
 * NOMBRE del registro como dato autenticado, de modo que un registro copiado al lugar de otro no se abre y alterar un solo bit
 * tampoco: el descifrado falla, nunca devuelve datos dañados.
 */
export class AesGcmCipher {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  constructor(private readonly key: CryptoKey) {}

  async seal(name: string, value: unknown): Promise<Sealed> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const data = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: this.encoder.encode(name) },
      this.key,
      this.encoder.encode(JSON.stringify(value)),
    );
    return { iv, data };
  }

  /** Lo que se cifro como `name`. Lanza `RecordUnreadableError` si no se abre o si lo que abre no es JSON. */
  async open(name: string, sealed: Sealed): Promise<unknown> {
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: sealed.iv, additionalData: this.encoder.encode(name) },
        this.key,
        sealed.data,
      );
      return JSON.parse(this.decoder.decode(plain)) as unknown;
    } catch {
      throw new RecordUnreadableError(name);
    }
  }
}

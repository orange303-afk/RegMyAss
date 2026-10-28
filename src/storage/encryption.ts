/**
 * QuickPass - Cryptographic Vault
 * AES-256-GCM encryption with PBKDF2 key derivation using Web Crypto API.
 */

export interface EncryptedData {
  ciphertext: string; // base64
  iv: string; // base64
  salt: string; // base64
}

export class VaultEncryption {
  private static readonly PBKDF2_ITERATIONS = 100000;
  private static cachedKey: CryptoKey | null = null;
  private static lockTimeoutTimer: any = null;

  /**
   * Derives an AES-GCM CryptoKey from a master password and salt.
   */
  public static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts plaintext string using AES-GCM.
   */
  public static async encrypt(plaintext: string, password: string): Promise<EncryptedData> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);

    const encoded = new TextEncoder().encode(plaintext);
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    return {
      ciphertext: this.bufferToBase64(new Uint8Array(ciphertextBuffer)),
      iv: this.bufferToBase64(iv),
      salt: this.bufferToBase64(salt),
    };
  }

  /**
   * Decrypts AES-GCM ciphertext.
   */
  public static async decrypt(encrypted: EncryptedData, password: string): Promise<string> {
    const salt = this.base64ToBuffer(encrypted.salt);
    const iv = this.base64ToBuffer(encrypted.iv);
    const ciphertext = this.base64ToBuffer(encrypted.ciphertext);

    const key = await this.deriveKey(password, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  /**
   * Sets cached session key in memory with auto-lock timeout.
   */
  public static unlockVault(key: CryptoKey, autoLockMinutes: number = 15): void {
    this.cachedKey = key;
    clearTimeout(this.lockTimeoutTimer);
    this.lockTimeoutTimer = setTimeout(() => {
      this.lockVault();
    }, autoLockMinutes * 60 * 1000);
  }

  public static lockVault(): void {
    this.cachedKey = null;
    clearTimeout(this.lockTimeoutTimer);
  }

  public static isUnlocked(): boolean {
    return this.cachedKey !== null;
  }

  private static bufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  private static base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

import { Injectable } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

@Injectable()
export class VaultService {
  constructor(private readonly encryptionService: EncryptionService) {}

  /**
   * Encrypts a sensitive field if it's not already encrypted.
   */
  encrypt(value: string | null | undefined): string | null | undefined {
    if (!value) return value;
    // Basic check: if it contains ":" (iv:tag:content), it's likely already encrypted
    if (value.includes(':')) {
      const parts = value.split(':');
      if (parts.length === 3) return value;
    }
    return this.encryptionService.encrypt(value);
  }

  /**
   * Decrypts a sensitive field.
   */
  decrypt(value: string | null | undefined): string | null | undefined {
    if (!value) return value;
    try {
      return this.encryptionService.decrypt(value);
    } catch (e) {
      // If decryption fails, return as is (legacy plain text)
      return value;
    }
  }

  /**
   * Encrypts a set of fields in an object.
   */
  encryptObject<T extends Record<string, any>>(obj: T, fields: string[]): T {
    const result = { ...obj };
    for (const field of fields) {
      if (result[field]) {
        result[field as keyof T] = this.encrypt(result[field]) as any;
      }
    }
    return result;
  }

  /**
   * Decrypts a set of fields in an object.
   */
  decryptObject<T extends Record<string, any>>(obj: T, fields: string[]): T {
    const result = { ...obj };
    for (const field of fields) {
      if (result[field]) {
        result[field as keyof T] = this.decrypt(result[field]) as any;
      }
    }
    return result;
  }
}

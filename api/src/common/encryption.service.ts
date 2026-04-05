import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    // In a real app, this should come from process.env.ENCRYPTION_KEY
    // For this bench environment, we use a stable derivate if not provided
    const secret = process.env.ENCRYPTION_KEY || 'aedra-default-encryption-secret-32-chars-!!';
    this.key = crypto.scryptSync(secret, 'salt', 32);
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    
    // Return iv:tag:encrypted
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  decrypt(hash: string): string {
    const parts = hash.split(':');
    if (parts.length !== 3) return hash; // Not encrypted or wrong format

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
